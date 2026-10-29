"""Vibear API. Run with: uvicorn app.main:create_app --factory"""

import asyncio
from contextlib import asynccontextmanager
from dataclasses import asdict

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Path, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

from app.config import Settings
from app.demo import DemoLens
from app.images import ImageError, decode_image, encode_jpeg, fetch_image
from app.lens import UPLOAD_MAX_BYTES, LensClient, SerpApiError
from app.ml.detector import YoloGarmentDetector, crop_detections
from app.ml.embedder import ClipEmbedder
from app.rerank import http_loader, rank_by_similarity
from app.schemas import DetectedItem, DetectResponse, Match, SearchRequest, SearchResponse
from app.storage import ID_PATTERN, MediaStore

# An honest bot UA with a contact link: sites like Wikimedia answer 403 to browser-looking bot UAs.
USER_AGENT = "VibearBot/0.2 (+https://github.com/matiasbellidor/Vibear-)"


def create_app(
    settings: Settings | None = None,
    *,
    detector=None,
    embedder=None,
    lens=None,
    client: httpx.AsyncClient | None = None,
) -> FastAPI:
    """Build the app. Tests inject fakes; in production every dependency is created at startup."""
    settings = settings or Settings()
    store = MediaStore(settings.data_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        state = app.state
        state.http = client if client is not None else httpx.AsyncClient(headers={"User-Agent": USER_AGENT})
        state.detector = detector or YoloGarmentDetector(
            settings.yolo_repo, settings.yolo_file, settings.detect_confidence
        )
        state.embedder = embedder or ClipEmbedder(settings.clip_model)
        # The first inference is ~10x slower than the rest: pay it at startup, not on the first user.
        blank = Image.new("RGB", (64, 64), "white")
        state.detector.detect(blank)
        state.embedder.embed([blank])

        state.lens = lens
        if lens is None and settings.serpapi_api_key:
            state.lens = LensClient(
                settings.serpapi_api_key, settings.serpapi_country, settings.serpapi_hl, state.http
            )
        elif lens is None and settings.demo_search:
            state.lens = DemoLens(store)
        if state.lens is None:
            state.search_mode = "off"
        else:
            state.search_mode = "demo" if isinstance(state.lens, DemoLens) else "serpapi"
        yield
        if client is None:
            await state.http.aclose()

    app = FastAPI(title="Vibear API", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )
    app.mount("/media", StaticFiles(directory=store.images_dir), name="media")

    @app.get("/health")
    async def health(request: Request):
        return {"status": "ok", "search": request.app.state.search_mode}

    @app.post("/v1/detect", response_model=DetectResponse)
    async def detect(
        request: Request,
        file: UploadFile | None = File(None),
        image_url: str | None = Form(None),
    ):
        """Find garments in a photo and return one crop per garment. Local and free: no SerpApi call."""
        if (file is None) == (image_url is None):
            raise HTTPException(400, "Send exactly one of: file, image_url")
        max_bytes = settings.max_upload_mb * 1024 * 1024
        try:
            if file is not None:
                data = await file.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise HTTPException(413, f"Image is larger than {settings.max_upload_mb} MB")
            else:
                data = await fetch_image(image_url, max_bytes, request.app.state.http)
            image = decode_image(data)
        except ImageError as exc:
            raise HTTPException(422, str(exc)) from exc

        image_id = store.put(encode_jpeg(image))
        detections = await asyncio.to_thread(request.app.state.detector.detect, image)
        # Crops are stored already under the SerpApi upload limit, so /v1/search sends them as-is.
        found = [
            (det.label, det.confidence, det.box, crop) for det, crop in crop_detections(image, detections)
        ]
        if not found:
            found = [("full_image", None, (0, 0, image.width, image.height), image)]

        items = []
        for label, confidence, box, crop in found:
            crop_id = store.put(encode_jpeg(crop, UPLOAD_MAX_BYTES))
            items.append(
                DetectedItem(
                    crop_id=crop_id, label=label, confidence=confidence, box=box, crop_url=f"/media/{crop_id}.jpg"
                )
            )
        look = DetectResponse(image_id=image_id, width=image.width, height=image.height, items=items)
        store.save_look(image_id, look.model_dump())
        return look

    @app.get("/v1/looks/{image_id}", response_model=DetectResponse)
    async def get_look(image_id: str = Path(pattern=ID_PATTERN)):
        """A look detected earlier, so the UI can link to it and survive a refresh."""
        look = store.get_look(image_id)
        if look is None:
            raise HTTPException(404, "Unknown look")
        return look

    @app.post("/v1/search", response_model=SearchResponse)
    async def search(body: SearchRequest, request: Request):
        """Shoppable matches for one crop, as a single list ordered by CLIP similarity.

        A cache miss spends one SerpApi search; the same crop is served from cache afterwards.
        Demo results are never cached, because they change as more photos are uploaded.
        """
        state = request.app.state
        jpeg = store.get(body.crop_id)
        if jpeg is None:
            raise HTTPException(404, "Unknown crop_id")

        demo = state.search_mode == "demo"
        cache_key = f"{body.crop_id}-{settings.serpapi_country}-{settings.serpapi_hl}"
        cached = None if demo else store.read_cache(cache_key, settings.search_cache_hours)
        if cached is not None:
            results = cached["results"]
        else:
            if state.lens is None:
                raise HTTPException(503, "Search is disabled: set SERPAPI_API_KEY (or DEMO_SEARCH=true)")
            try:
                matches = await state.lens.visual_matches(jpeg)
            except SerpApiError as exc:
                raise HTTPException(502, str(exc)) from exc
            load = state.lens.loader() if demo else http_loader(state.http)
            ranked = await rank_by_similarity(decode_image(jpeg), matches, state.embedder, load)
            results = [
                Match(
                    **asdict(r.match),
                    thumbnail_width=r.size[0] if r.size else None,
                    thumbnail_height=r.size[1] if r.size else None,
                    similarity=r.similarity,
                ).model_dump()
                for r in ranked
            ]
            if not demo:
                store.write_cache(cache_key, {"results": results})

        return SearchResponse(crop_id=body.crop_id, cached=cached is not None, results=results[: body.limit])

    return app
