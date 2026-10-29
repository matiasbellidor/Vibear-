import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
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


async def rank_by_similarity(
    query: Image.Image,
    matches: list[LensMatch],
    embedder: ClipEmbedder,
    load: ThumbnailLoader,
) -> list[RankedMatch]:
    """Order Lens matches by CLIP similarity to the crop. Matches without a usable thumbnail go last."""
    thumbnails = await asyncio.gather(*(_load_or_none(load, m.thumbnail) for m in matches))

    scored = [(m, img) for m, img in zip(matches, thumbnails) if img is not None]
    unscored = [RankedMatch(m, None, None) for m, img in zip(matches, thumbnails) if img is None]
    if not scored:
        return unscored

    # CPU-bound: run in a thread so the event loop keeps serving other requests.
    vectors = await asyncio.to_thread(embedder.embed, [query] + [img for _, img in scored])
    similarities = vectors[1:] @ vectors[0]
    ranked = [RankedMatch(m, round(float(s), 4), img.size) for (m, img), s in zip(scored, similarities)]
    ranked.sort(key=lambda r: r.similarity, reverse=True)
    return ranked + unscored


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
