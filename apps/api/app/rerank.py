import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
import numpy as np
from PIL import Image

from app.colorsig import color_affinity, color_signature
from app.images import ImageError, decode_image
from app.lens import LensMatch
from app.ml.embedder import ClipEmbedder

MAX_CONCURRENT_DOWNLOADS = 10
# How much colour counts next to CLIP's look. Calibrated on the demo catalog (52 queries, the top 5
# of each one's family from other photos): 0.1 brought the results' colour 15% closer (CIE76
# distance 26.7 -> 22.6) for 0.004 less CLIP similarity; more weight bought little colour and
# started to cost look.
COLOR_WEIGHT = 0.1

ThumbnailLoader = Callable[[str], Awaitable[Image.Image | None]]


@dataclass(frozen=True)
class RankedMatch:
    match: LensMatch
    similarity: float | None  # look (CLIP cosine) nudged by colour agreement; None if the thumbnail failed
    size: tuple[int, int] | None  # thumbnail width, height: lets the UI reserve space before it loads


Embedded = tuple[np.ndarray, tuple[int, int], np.ndarray]  # CLIP vector, thumbnail size, Lab colour


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
    keep: Callable[[np.ndarray], bool] | None = None,
    floor: float | None = None,
) -> list[RankedMatch]:
    """Order Lens matches by similarity to the crop. Matches without a usable thumbnail go last.

    Similarity is CLIP's (shape, texture, style) moved up to COLOR_WEIGHT / 2 either way by how close
    the main colours are. `keep` drops results whose picture is another kind of thing (shoes for a
    sweater), and `floor` those whose CLIP similarity is lower than that: both judge the look alone
    (that is what they were calibrated on), and only results that have a picture.
    """
    entries: list[Embedded | None] = [
        cache.get(m.thumbnail) if cache is not None and m.thumbnail else None for m in matches
    ]
    missing = [i for i, entry in enumerate(entries) if entry is None]
    images = await asyncio.gather(*(_load_or_none(load, matches[i].thumbnail) for i in missing))
    fresh = [(i, img) for i, img in zip(missing, images) if img is not None]
    if not fresh and all(entry is None for entry in entries):
        return [RankedMatch(m, None, None) for m in matches]

    # CPU-bound: run in a thread so the event loop keeps serving other requests.
    pictures = [query] + [img for _, img in fresh]
    vectors, colors = await asyncio.to_thread(lambda: (embedder.embed(pictures), [color_signature(p) for p in pictures]))
    for (i, img), vector, color in zip(fresh, vectors[1:], colors[1:]):
        entries[i] = (vector, img.size, color)
        if cache is not None and matches[i].thumbnail:
            cache.put(matches[i].thumbnail, entries[i])

    def similarity(entry: Embedded) -> float:
        look = float(entry[0] @ vectors[0])
        return min(1.0, max(0.0, look + COLOR_WEIGHT * (color_affinity(colors[0], entry[2]) - 0.5)))

    ranked = [
        RankedMatch(m, round(similarity(entry), 4), entry[1])
        for m, entry in zip(matches, entries)
        if entry is not None
        and (keep is None or keep(entry[0]))
        and (floor is None or float(entry[0] @ vectors[0]) >= floor)
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
