from PIL import Image

from app.images import ImageError, decode_image
from app.lens import LensMatch
from app.storage import MediaStore, content_id

DEMO_LIMIT = 40


class DemoLens:
    """Offline stand-in for SerpApi, so the UI can be built and tried without a key (DEMO_SEARCH=true).

    The "products" are the other images already in the local store, so the CLIP re-rank still
    runs on real pictures. Results are clearly fake: source "Vibear demo", links to the image itself.
    """

    def __init__(self, store: MediaStore):
        self._store = store

    async def visual_matches(self, jpeg: bytes) -> list[LensMatch]:
        own_id = content_id(jpeg)
        ids = [image_id for image_id in self._store.recent_ids(DEMO_LIMIT + 1) if image_id != own_id]
        return [
            LensMatch(
                title=f"Demo item {n}",
                link=f"/media/{image_id}.jpg",
                source="Vibear demo",
                thumbnail=f"/media/{image_id}.jpg",
                price=None,
            )
            for n, image_id in enumerate(ids[:DEMO_LIMIT], start=1)
        ]

    def loader(self):
        """Thumbnail loader that reads demo thumbnails from disk instead of over HTTP."""

        async def load(url: str) -> Image.Image | None:
            data = self._store.get(url.removeprefix("/media/").removesuffix(".jpg"))
            try:
                return decode_image(data) if data else None
            except ImageError:
                return None

        return load
