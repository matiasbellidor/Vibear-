import asyncio

from conftest import BLUE, LENS_MATCHES, RED, FakeEmbedder, png_bytes
from PIL import Image

from app.images import decode_image
from app.rerank import VectorCache, rank_by_similarity

IMAGES = {"https://img.test/red.png": RED, "https://img.test/blue.png": BLUE, "https://img.test/gray.png": (128, 128, 128)}


class CountingEmbedder(FakeEmbedder):
    def __init__(self):
        self.embedded = 0

    def embed(self, images):
        self.embedded += len(images)
        return super().embed(images)


def counting_loader(calls: list[str]):
    async def load(url):
        calls.append(url)
        color = IMAGES.get(url)
        return decode_image(png_bytes(color)) if color else None

    return load


def test_cached_thumbnails_are_neither_downloaded_nor_embedded_again():
    cache, embedder, calls = VectorCache(), CountingEmbedder(), []
    query = Image.new("RGB", (64, 64), RED)

    first = asyncio.run(rank_by_similarity(query, LENS_MATCHES, embedder, counting_loader(calls), cache))
    assert [r.match.title for r in first] == ["red", "gray", "blue", "broken"]
    assert embedder.embedded == 4  # the crop + 3 thumbnails (the broken one never loads)

    calls.clear()
    second = asyncio.run(rank_by_similarity(query, LENS_MATCHES, embedder, counting_loader(calls), cache))
    assert [(r.match.title, r.similarity, r.size) for r in second] == [(r.match.title, r.similarity, r.size) for r in first]
    assert calls == ["https://img.test/missing.png"]  # only the broken one is retried
    assert embedder.embedded == 5  # just the new crop


def test_the_cache_keeps_the_most_recently_used():
    cache = VectorCache(size=2)
    for url in ["a", "b"]:
        cache.put(url, (None, (1, 1)))
    cache.get("a")
    cache.put("c", (None, (1, 1)))
    assert cache.get("b") is None and cache.get("a") is not None and cache.get("c") is not None
