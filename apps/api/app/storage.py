import hashlib
import json
import re
import time
from pathlib import Path

ID_PATTERN = r"^[0-9a-f]{16}$"
_ID_RE = re.compile(ID_PATTERN)
CLOSET_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def content_id(jpeg: bytes) -> str:
    return hashlib.sha256(jpeg).hexdigest()[:16]


class MediaStore:
    """Images on local disk, addressed by content hash, plus JSON for looks and cached search results.

    Content addressing means the same crop always gets the same id, so a repeated
    search hits the cache instead of spending SerpApi quota.
    """

    def __init__(self, root: Path):
        self.images_dir = root / "images"
        self.looks_dir = root / "looks"
        self.cache_dir = root / "cache"
        self.closets_dir = root / "closets"
        self.profiles_dir = root / "profiles"
        for folder in (self.images_dir, self.looks_dir, self.cache_dir, self.closets_dir, self.profiles_dir):
            folder.mkdir(parents=True, exist_ok=True)

    def put(self, jpeg: bytes) -> str:
        image_id = content_id(jpeg)
        path = self.images_dir / f"{image_id}.jpg"
        if not path.exists():
            path.write_bytes(jpeg)
        return image_id

    def get(self, image_id: str) -> bytes | None:
        if not _ID_RE.fullmatch(image_id):
            return None
        path = self.images_dir / f"{image_id}.jpg"
        return path.read_bytes() if path.exists() else None

    def recent_ids(self, limit: int) -> list[str]:
        paths = sorted(self.images_dir.glob("*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
        return [p.stem for p in paths[:limit]]

    def save_look(self, image_id: str, look: dict) -> None:
        _write_json(self.looks_dir / f"{image_id}.json", look)

    def get_look(self, image_id: str) -> dict | None:
        path = self.looks_dir / f"{image_id}.json"
        if not _ID_RE.fullmatch(image_id) or not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def read_cache(self, key: str, max_age_hours: int) -> dict | None:
        path = self.cache_dir / f"{key}.json"
        if not path.exists() or time.time() - path.stat().st_mtime > max_age_hours * 3600:
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write_cache(self, key: str, payload: dict) -> None:
        _write_json(self.cache_dir / f"{key}.json", payload)

    def read_closet(self, closet_id: str) -> dict | None:
        path = self.closets_dir / f"{closet_id}.json"
        if not CLOSET_ID_RE.fullmatch(closet_id) or not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write_closet(self, closet_id: str, closet: dict) -> None:
        if not CLOSET_ID_RE.fullmatch(closet_id):
            raise ValueError("Invalid closet id")
        _write_json(self.closets_dir / f"{closet_id}.json", closet)

    def read_profile(self, closet_id: str) -> dict | None:
        """The same anonymous browser as the closet (its cookie id), its style profile."""
        path = self.profiles_dir / f"{closet_id}.json"
        if not CLOSET_ID_RE.fullmatch(closet_id) or not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write_profile(self, closet_id: str, profile: dict) -> None:
        if not CLOSET_ID_RE.fullmatch(closet_id):
            raise ValueError("Invalid closet id")
        _write_json(self.profiles_dir / f"{closet_id}.json", profile)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
