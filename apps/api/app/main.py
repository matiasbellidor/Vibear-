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
from app.lens import UPLOAD_MAX_BYTES, LensClient, SerpApiError, is_argentine_shop
from app.ml.accessories import AccessoryDetector, FashionDetector
from app.ml.describe import GarmentDescriber, brand_from_titles, family_of
from app.ml.detector import YoloGarmentDetector, crop_detections
from app.ml.embedder import ClipEmbedder
from app.places import PlaceError, geocode, nearby
from app.prices import PriceBoard, PriceError
from app.rerank import VectorCache, http_loader, rank_by_similarity
from app.ml.pose import YoloPose
from app.schemas import (
    Body, BrandGuess, Closet, DetectedItem, DetectResponse, Garment, Garments, Match, Profile, SearchRequest,
    SearchResponse,
)
from app.storage import CLOSET_ID_RE, ID_PATTERN, MediaStore
from app.tryon import (
    FAMILY_SLOTS, LAYER, MAX_GARMENTS, SLOTS, cut_garment, cut_white, data_url, is_full_body, normalized,
)

# An honest bot UA with a contact link: sites like Wikimedia answer 403 to browser-looking bot UAs.
USER_AGENT = "VibearBot/0.2 (+https://github.com/matiasbellidor/Vibear-)"

# The closet backup has no accounts: an anonymous random id in an HttpOnly cookie. A cookie set by the
# server is not script-writable storage, so Safari's 7-day purge of site data leaves it alone.
CLOSET_COOKIE = "vibear_closet"
CLOSET_MAX_AGE = 400 * 24 * 3600  # browsers cap cookie lifetimes at 400 days; each visit renews it
CLOSET_MAX_BYTES = 1024 * 1024
PROFILE_MAX_BYTES = 16 * 1024

# FashionCLIP cosine below which a result doesn't look like the garment: on the demo catalog, close
# matches score 0.6-0.75 and same-category but unalike ones ~0.5. Only applied with the real model:
# the test fakes have another scale.
SIMILARITY_FLOOR = 0.55


def create_app(
    settings: Settings | None = None,
    *,
    detector=None,
    embedder=None,
    describer=None,
    lens=None,
    pose=None,
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
        # Clothes with their outlines (YOLO DeepFashion2) plus shoes and accessories (YOLOS Fashionpedia).
        state.detector = detector or FashionDetector(
            YoloGarmentDetector(settings.yolo_repo, settings.yolo_file, settings.detect_confidence),
            AccessoryDetector(settings.accessory_repo),
        )
        state.embedder = embedder or ClipEmbedder(settings.clip_model)
        # Names garments with the same FashionCLIP. Tests that inject a fake embedder get none
        # (they can inject a fake describer instead).
        state.describer = describer or (GarmentDescriber(state.embedder) if embedder is None else None)
        state.pose = pose or YoloPose(settings.pose_repo, settings.pose_file)
        # The first inference is ~10x slower than the rest: pay it at startup, not on the first user.
        blank = Image.new("RGB", (64, 64), "white")
        state.detector.detect(blank)
        state.embedder.embed([blank])
        state.pose.keypoints(blank)
        if state.describer is not None:
            state.describer.warm()

        state.prices = PriceBoard(state.http, USER_AGENT, settings.serpapi_api_key)
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

    async def read_image(request: Request, file: UploadFile | None, image_url: str | None) -> Image.Image:
        """The photo sent as a file or a link (fetched with the SSRF guards in app/images.py)."""
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
            return decode_image(data)
        except ImageError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/v1/detect", response_model=DetectResponse)
    async def detect(
        request: Request,
        file: UploadFile | None = File(None),
        image_url: str | None = Form(None),
    ):
        """Find garments in a photo and return one crop per garment. Local and free: no SerpApi call."""
        image = await read_image(request, file, image_url)
        image_id = store.put(encode_jpeg(image))
        state = request.app.state
        detections = await asyncio.to_thread(state.detector.detect, image)
        found = crop_detections(image, detections)
        names = [None] * len(found)
        if found and state.describer is not None:
            names = await asyncio.to_thread(describe_all, state, image, found)

        items = []
        # Crops are stored already under the SerpApi upload limit, so /v1/search sends them as-is.
        for (det, crop), description in zip(found, names):
            crop_id = store.put(encode_jpeg(crop, UPLOAD_MAX_BYTES))
            items.append(
                DetectedItem(
                    crop_id=crop_id,
                    label=det.label,
                    confidence=det.confidence,
                    box=det.box,
                    crop_url=f"/media/{crop_id}.jpg",
                    name=description.name if description else None,
                    kind=description.kind if description else None,
                    brand=description.brand if description else None,
                    similar=description.similar if description else None,
                    color=description.color if description else None,
                )
            )
        if not items:
            crop_id = store.put(encode_jpeg(image, UPLOAD_MAX_BYTES))
            items.append(
                DetectedItem(
                    crop_id=crop_id, label="full_image", confidence=None, box=(0, 0, image.width, image.height),
                    crop_url=f"/media/{crop_id}.jpg",
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
        # "local": results are Argentine shops only (older cache entries weren't filtered).
        cache_key = f"{body.crop_id}-{body.label or 'any'}-{settings.serpapi_country}-{settings.serpapi_hl}-local"
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
            if not demo:  # demo results are your own photos, not shops
                matches = [m for m in matches if is_argentine_shop(m.link)]
            load = state.lens.loader() if demo else http_loader(state.http)
            family = family_of(body.label)
            describer = state.describer
            ranked = await rank_by_similarity(
                decode_image(jpeg), matches, state.embedder, load, vectors,
                keep=(lambda vector: describer.belongs(vector, family)) if describer and family else None,
                floor=SIMILARITY_FLOOR if describer else None,
            )
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

        # The brand the closest real results agree on (demo results are photos, not products).
        guess = None if demo else brand_from_titles([r["title"] for r in results[:12]])
        return SearchResponse(
            crop_id=body.crop_id,
            cached=cached is not None,
            results=results[: body.limit],
            brand=BrandGuess(name=guess[0], count=guess[1], total=min(12, len(results))) if guess else None,
        )

    def describe_all(state, image, found):
        """Name each garment (CPU-bound; runs in a thread). One batched CLIP pass: the whole photo
        (is it menswear?) and every crop."""
        whole, *vectors = state.embedder.embed([image] + [crop for _, crop in found])
        man = state.describer.is_menswear(whole)
        return [
            state.describer.describe(crop, det.label, image, det.box, det.polygon, vector=vector, man=man)
            for (det, crop), vector in zip(found, vectors)
        ]

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

    @app.get("/v1/profile", response_model=Profile)
    async def get_profile(request: Request, response: Response):
        """This browser's style profile (the style test and its colour analysis); a new one until
        it answers or skips the test."""
        closet_id = closet_id_of(request)
        saved = store.read_profile(closet_id) if closet_id else None
        if saved is None:
            return Profile()
        keep_closet_cookie(response, request, closet_id)
        return saved

    @app.put("/v1/profile", response_model=Profile)
    async def put_profile(body: Profile, request: Request, response: Response):
        """Back up this browser's style profile, under the same anonymous cookie as its closet. The
        newest copy wins (updated_at). Returns the copy that is kept."""
        if int(request.headers.get("content-length") or 0) > PROFILE_MAX_BYTES:
            raise HTTPException(413, "Profile is too large")
        closet_id = closet_id_of(request) or secrets.token_hex(16)
        kept = store.read_profile(closet_id)
        if kept is None or body.updated_at >= kept["updated_at"]:
            kept = body.model_dump()
            store.write_profile(closet_id, kept)
        keep_closet_cookie(response, request, closet_id)
        return kept

    @app.post("/v1/tryon/body", response_model=Body)
    async def tryon_body(request: Request, file: UploadFile = File(...)):
        """Where your shoulders, hips, knees and ankles are in a full-body photo, for the fitting
        room. The photo is read in memory and not kept."""
        image = await read_image(request, file, None)
        points = await asyncio.to_thread(request.app.state.pose.keypoints, image)
        if not is_full_body(points):
            raise HTTPException(422, "No full body found")
        return Body(width=image.width, height=image.height, keypoints=normalized(points, image.width, image.height))

    @app.post("/v1/tryon/garments", response_model=Garments)
    async def tryon_garments(
        request: Request,
        file: UploadFile | None = File(None),
        image_url: str | None = Form(None),
    ):
        """Every garment in a photo, cut out for the fitting room: a full outfit gives a top, trousers
        and a jacket at once. With the person wearing them, their pose comes back too, so each piece can
        be fitted shoulder to shoulder. Nothing is stored."""
        image = await read_image(request, file, image_url)
        state = request.app.state
        return await asyncio.to_thread(cut_garments, state, image)

    def cut_garments(state, image: Image.Image) -> Garments:
        width, height = image.size
        detections = [d for d in sorted(state.detector.detect(image), key=lambda d: d.confidence, reverse=True) if d.label in SLOTS]
        detections = detections[:MAX_GARMENTS]
        on_top = lambda det: [o for o in detections if LAYER[SLOTS[o.label]] > LAYER[SLOTS[det.label]]]  # noqa: E731
        cuts = [(det, cut) for det in detections if (cut := cut_garment(image, det, on_top(det)))]
        items = []
        for det, (piece, (x1, y1, x2, y2)) in cuts:
            description = state.describer.describe(image.crop((x1, y1, x2, y2)), det.label, image, det.box, det.polygon) \
                if state.describer is not None else None
            items.append(Garment(slot=SLOTS[det.label], label=det.label, name=description.name if description else None,
                                 image=data_url(piece), box=(x1 / width, y1 / height, x2 / width, y2 / height)))
        pose = None
        if items:
            points = state.pose.keypoints(image)
            pose = normalized(points, width, height) if is_full_body(points) else None
        else:
            piece = cut_white(image)
            if piece is None:
                raise HTTPException(422, "No garment found")
            slot = "top"
            if state.describer is not None:
                shares = state.describer.family_shares(state.embedder.embed([image])[0])
                slot = FAMILY_SLOTS.get(max(shares, key=shares.get), "top")
            items.append(Garment(slot=slot, label=None, name=None, image=data_url(piece), box=(0, 0, 1, 1)))
        return Garments(width=width, height=height, pose=pose, items=items)

    @app.get("/v1/fragrances")
    async def fragrances(request: Request):
        """The perfumery catalogue: every fragrance with its best price at Argentine shops and the
        shop's own photo of the bottle. Cached 12 h."""
        return await request.app.state.prices.catalogue()

    @app.get("/v1/fragrances/{fragrance_id}/prices")
    async def fragrance_prices(request: Request, fragrance_id: str = Path(pattern=r"^[a-z0-9-]{1,40}$")):
        """Where to buy a fragrance, cheapest first: Google Shopping (with a SerpApi key) plus the
        prices shops publish on their product pages. Cached, so it never makes a visitor wait twice."""
        try:
            return await request.app.state.prices.prices(fragrance_id)
        except PriceError as exc:
            raise HTTPException(404, str(exc)) from exc

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
