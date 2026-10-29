import json
from pathlib import Path

from PIL import Image

from app.images import ImageError, decode_image
from app.lens import LensMatch

DEMO_PREFIX = "/demo/"


class DemoLens:
    """Offline stand-in for SerpApi, so the app works without a key (DEMO_SEARCH=true).

    The "products" are a small catalog of garment crops from freely licensed photos
    (app/demo_catalog, built by scripts/build_landing_assets.py), so the CLIP re-rank runs on
    real clothes and the very first search already returns similar garments. Each result
    links to the photo's source page and is labelled "Catálogo demo".
    """

    def __init__(self, catalog_dir: Path):
        self._dir = catalog_dir
        path = catalog_dir / "catalog.json"
        self._items = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

    async def visual_matches(self, jpeg: bytes) -> list[LensMatch]:
        return [
            LensMatch(
                title=item["title"],
                link=item["link"],
                source="Catálogo demo",
                thumbnail=f"{DEMO_PREFIX}{item['file']}",
                price=None,
            )
            for item in self._items
        ]

    def loader(self):
        """Thumbnail loader that reads the catalog from disk instead of over HTTP."""

        async def load(url: str) -> Image.Image | None:
            name = Path(url.removeprefix(DEMO_PREFIX)).name  # never leave the catalog folder
            path = self._dir / name
            try:
                return decode_image(path.read_bytes()) if path.is_file() else None
            except ImageError:
                return None

        return load
