"""Vibear API. Run with: uvicorn app.main:create_app --factory"""

import asyncio
from contextlib import asynccontextmanager
from dataclasses import asdict

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.images import ImageError, decode_image, encode_jpeg, fetch_image
from app.lens import UPLOAD_MAX_BYTES, LensClient, SerpApiError
from app.ml.detector import YoloGarmentDetector, crop_detections
from app.ml.embedder import ClipEmbedder
from app.rerank import rank_by_similarity
from app.schemas import DetectedItem, DetectResponse, Match, SearchRequest, SearchResponse
from app.storage import MediaStore

USER_AGENT = "Mozilla/5.0 (compatible; VibearBot/0.1)"


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
        state.lens = lens
        if lens is None and settings.serpapi_api_key:
            state.lens = LensClient(
                settings.serpapi_api_key, settings.serpapi_country, settings.serpapi_hl, state.http
            )
        yield
        if client is None:
            await state.http.aclose()

    app = FastAPI(title="Vibear API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )
    app.mount("/media", StaticFiles(directory=store.images_dir), name="media")

    @app.get("/health")
    async def health(request: Request):
        return {"status": "ok", "search_enabled": request.app.state.lens is not None}

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
            crop_url = str(request.url_for("media", path=f"{crop_id}.jpg"))
            items.append(
                DetectedItem(crop_id=crop_id, label=label, confidence=confidence, box=box, crop_url=crop_url)
            )
        return DetectResponse(image_id=image_id, width=image.width, height=image.height, items=items)

    @app.post("/v1/search", response_model=SearchResponse)
    async def search(body: SearchRequest, request: Request):
        """Shoppable matches for one crop, as a single list ordered by CLIP similarity.

        A cache miss spends one SerpApi search; the same crop is served from cache afterwards.
        """
        state = request.app.state
        jpeg = store.get(body.crop_id)
        if jpeg is None:
            raise HTTPException(404, "Unknown crop_id")

        cache_key = f"{body.crop_id}-{settings.serpapi_country}-{settings.serpapi_hl}"
        cached = store.read_cache(cache_key, settings.search_cache_hours)
        if cached is not None:
            results = cached["results"]
        else:
            if state.lens is None:
                raise HTTPException(503, "Search is disabled: set SERPAPI_API_KEY")
            try:
                matches = await state.lens.visual_matches(jpeg)
            except SerpApiError as exc:
                raise HTTPException(502, str(exc)) from exc
            ranked = await rank_by_similarity(decode_image(jpeg), matches, state.embedder, state.http)
            results = [Match(**asdict(r.match), similarity=r.similarity).model_dump() for r in ranked]
            store.write_cache(cache_key, {"results": results})

        return SearchResponse(crop_id=body.crop_id, cached=cached is not None, results=results[: body.limit])

    return app
