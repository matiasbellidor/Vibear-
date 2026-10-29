import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
import numpy as np
from PIL import Image

from app.images import ImageError, decode_image
from app.lens import LensMatch
from app.ml.embedder import ClipEmbedder

MAX_CONCURRENT_DOWNLOADS = 10

ThumbnailLoader = Callable[[str], Awaitable[Image.Image | None]]


@dataclass(frozen=True)
class RankedMatch:
    match: LensMatch
    similarity: float | None  # cosine similarity crop vs thumbnail; None if the thumbnail failed
    size: tuple[int, int] | None  # thumbnail width, height: lets the UI reserve space before it loads


Embedded = tuple[np.ndarray, tuple[int, int]]  # CLIP vector and thumbnail size


class VectorCache:
    """Thumbnail vectors by URL, least recently used dropped first (4096 x 512 floats is ~8 MB).

    The same products come back across searches (the demo catalog in every one), so each
    thumbnail is downloaded and embedded once: CLIP on CPU is most of a search's time.
    """

    def __init__(self, size: int = 4096):
        self.size = size
        self._items: OrderedDict[str, Embedded] = OrderedDict()

    def get(self, url: str) -> Embedded | None:
        entry = self._items.get(url)
        if entry is not None:
            self._items.move_to_end(url)
        return entry

    def put(self, url: str, entry: Embedded) -> None:
        self._items[url] = entry
        self._items.move_to_end(url)
        while len(self._items) > self.size:
            self._items.popitem(last=False)


async def rank_by_similarity(
    query: Image.Image,
    matches: list[LensMatch],
    embedder: ClipEmbedder,
    load: ThumbnailLoader,
    cache: VectorCache | None = None,
) -> list[RankedMatch]:
    """Order Lens matches by CLIP similarity to the crop. Matches without a usable thumbnail go last."""
    entries: list[Embedded | None] = [
        cache.get(m.thumbnail) if cache is not None and m.thumbnail else None for m in matches
    ]
    missing = [i for i, entry in enumerate(entries) if entry is None]
    images = await asyncio.gather(*(_load_or_none(load, matches[i].thumbnail) for i in missing))
    fresh = [(i, img) for i, img in zip(missing, images) if img is not None]
    if not fresh and all(entry is None for entry in entries):
        return [RankedMatch(m, None, None) for m in matches]

    # CPU-bound: run in a thread so the event loop keeps serving other requests.
    vectors = await asyncio.to_thread(embedder.embed, [query] + [img for _, img in fresh])
    for (i, img), vector in zip(fresh, vectors[1:]):
        entries[i] = (vector, img.size)
        if cache is not None and matches[i].thumbnail:
            cache.put(matches[i].thumbnail, entries[i])

    ranked = [
        RankedMatch(m, round(float(entry[0] @ vectors[0]), 4), entry[1])
        for m, entry in zip(matches, entries)
        if entry is not None
    ]
    ranked.sort(key=lambda r: r.similarity, reverse=True)
    return ranked + [RankedMatch(m, None, None) for m, entry in zip(matches, entries) if entry is None]


def http_loader(client: httpx.AsyncClient) -> ThumbnailLoader:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

    async def load(url: str) -> Image.Image | None:
        async with semaphore:
            try:
                response = await client.get(url, timeout=5, follow_redirects=True)
                response.raise_for_status()
                return decode_image(response.content)
            except (httpx.HTTPError, ImageError):
                return None

    return load


async def _load_or_none(load: ThumbnailLoader, url: str | None) -> Image.Image | None:
    return await load(url) if url else None
