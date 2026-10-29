"""Vibear API. Run with: uvicorn app.main:create_app --factory"""

import asyncio
import secrets
from contextlib import asynccontextmanager
from dataclasses import asdict

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Path, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

from app.config import Settings
from app.demo import DemoLens
from app.images import ImageError, decode_image, encode_jpeg, fetch_image
from app.lens import UPLOAD_MAX_BYTES, LensClient, SerpApiError
from app.ml.detector import YoloGarmentDetector, crop_detections
from app.ml.embedder import ClipEmbedder
from app.places import PlaceError, geocode, nearby
from app.rerank import VectorCache, http_loader, rank_by_similarity
from app.schemas import Closet, DetectedItem, DetectResponse, Match, SearchRequest, SearchResponse
from app.storage import CLOSET_ID_RE, ID_PATTERN, MediaStore

# An honest bot UA with a contact link: sites like Wikimedia answer 403 to browser-looking bot UAs.
USER_AGENT = "VibearBot/0.2 (+https://github.com/matiasbellidor/Vibear-)"

# The closet backup has no accounts: an anonymous random id in an HttpOnly cookie. A cookie set by the
# server is not script-writable storage, so Safari's 7-day purge of site data leaves it alone.
CLOSET_COOKIE = "vibear_closet"
CLOSET_MAX_AGE = 400 * 24 * 3600  # browsers cap cookie lifetimes at 400 days; each visit renews it
CLOSET_MAX_BYTES = 1024 * 1024


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
    vectors = VectorCache()

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
            state.lens = DemoLens(settings.demo_catalog_dir)
        if state.lens is None:
            state.search_mode = "off"
        else:
            state.search_mode = "demo" if isinstance(state.lens, DemoLens) else "serpapi"
        # The demo catalog is the same for every search: embed it in the background now, so the
        # first "Probar con un ejemplo" doesn't wait for it.
        warm = None
        if state.search_mode == "demo":
            catalog = await state.lens.visual_matches(b"")
            warm = asyncio.create_task(rank_by_similarity(blank, catalog, state.embedder, state.lens.loader(), vectors))
        yield
        if warm is not None:
            warm.cancel()
        if client is None:
            await state.http.aclose()

    app = FastAPI(title="Vibear API", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )
    app.mount("/media", StaticFiles(directory=store.images_dir), name="media")
    if settings.demo_catalog_dir.is_dir():
        app.mount("/demo", StaticFiles(directory=settings.demo_catalog_dir), name="demo")

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
            ranked = await rank_by_similarity(decode_image(jpeg), matches, state.embedder, load, vectors)
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

    def closet_id_of(request: Request) -> str | None:
        value = request.cookies.get(CLOSET_COOKIE, "")
        return value if CLOSET_ID_RE.fullmatch(value) else None

    def keep_closet_cookie(response: Response, request: Request, closet_id: str) -> None:
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        response.set_cookie(
            CLOSET_COOKIE,
            closet_id,
            max_age=CLOSET_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=scheme == "https",
        )

    @app.get("/v1/closet", response_model=Closet)
    async def get_closet(request: Request, response: Response):
        """This browser's backed-up saved products; empty until it saves something."""
        closet_id = closet_id_of(request)
        saved = store.read_closet(closet_id) if closet_id else None
        if saved is None:
            return Closet()
        keep_closet_cookie(response, request, closet_id)
        return saved

    @app.put("/v1/closet", response_model=Closet)
    async def put_closet(body: Closet, request: Request, response: Response):
        """Back up this browser's saved products. The newest copy wins (updated_at), so an older tab
        can't overwrite newer changes. Returns the copy that is kept."""
        if int(request.headers.get("content-length") or 0) > CLOSET_MAX_BYTES:
            raise HTTPException(413, "Closet is too large")
        closet_id = closet_id_of(request) or secrets.token_hex(16)
        kept = store.read_closet(closet_id)
        if kept is None or body.updated_at >= kept["updated_at"]:
            kept = body.model_dump()
            store.write_closet(closet_id, kept)
        keep_closet_cookie(response, request, closet_id)
        return kept

    @app.get("/v1/places/geocode")
    async def places_geocode(request: Request, q: str = Query(min_length=2, max_length=500)):
        """Coordinates for an address, neighbourhood, "lat, lng" or a Google Maps link."""
        try:
            location = await geocode(q, request.app.state.http)
        except PlaceError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
        return asdict(location)

    @app.get("/v1/places/nearby")
    async def places_nearby(
        request: Request,
        lat: float = Query(ge=-90, le=90),
        lng: float = Query(ge=-180, le=180),
        radius: int = Query(default=1500, ge=300, le=5000),
        brands: list[str] = Query(default=[]),
    ):
        """Clothing shops nearby (OpenStreetMap); shops of brands seen in the results come first."""
        try:
            shops = await nearby(lat, lng, radius, brands[:30], request.app.state.http)
        except PlaceError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
        return {"radius": radius, "shops": [asdict(shop) for shop in shops]}

    return app
