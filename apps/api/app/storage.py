import hashlib
import json
import re
import time
from pathlib import Path

ID_PATTERN = r"^[0-9a-f]{16}$"
_ID_RE = re.compile(ID_PATTERN)


class MediaStore:
    """Images on local disk, addressed by content hash, plus a JSON cache of search results.

    Content addressing means the same crop always gets the same id, so a repeated
    search hits the cache instead of spending SerpApi quota.
    """

    def __init__(self, root: Path):
        self.images_dir = root / "images"
        self.cache_dir = root / "cache"
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def put(self, jpeg: bytes) -> str:
        image_id = hashlib.sha256(jpeg).hexdigest()[:16]
        path = self.images_dir / f"{image_id}.jpg"
        if not path.exists():
            path.write_bytes(jpeg)
        return image_id

    def get(self, image_id: str) -> bytes | None:
        if not _ID_RE.fullmatch(image_id):
            return None
        path = self.images_dir / f"{image_id}.jpg"
        return path.read_bytes() if path.exists() else None

    def read_cache(self, key: str, max_age_hours: int) -> dict | None:
        path = self.cache_dir / f"{key}.json"
        if not path.exists() or time.time() - path.stat().st_mtime > max_age_hours * 3600:
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write_cache(self, key: str, payload: dict) -> None:
        path = self.cache_dir / f"{key}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
