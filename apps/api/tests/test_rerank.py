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
        cache.put(url, (None, (1, 1), None))
    cache.get("a")
    cache.put("c", (None, (1, 1), None))
    assert cache.get("b") is None and cache.get("a") is not None and cache.get("c") is not None


def test_results_of_another_kind_or_too_far_are_dropped():
    query = Image.new("RGB", (64, 64), RED)
    is_not_blue = lambda vector: vector[2] < 0.9  # stands in for "a pair of shoes" when scanning a top
    ranked = asyncio.run(
        rank_by_similarity(query, LENS_MATCHES, FakeEmbedder(), counting_loader([]), keep=is_not_blue, floor=0.5)
    )
    # blue: another kind (and far); gray: kept; red: kept; broken: no picture, so it can't be judged and stays last.
    assert [r.match.title for r in ranked] == ["red", "gray", "broken"]


class SameLookEmbedder:
    """CLIP sees every picture the same: only colour can tell them apart."""

    def embed(self, images):
        import numpy as np

        vectors = np.ones((len(images), 4))
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def test_among_equally_alike_results_the_same_colour_ranks_first():
    from app.lens import LensMatch

    navy, camel = (25, 35, 80), (190, 150, 100)
    pictures = {"https://img.test/camel.png": camel, "https://img.test/navy.png": navy}
    matches = [LensMatch(title=name, link=f"https://shop.test/{name}", source="Shop", thumbnail=f"https://img.test/{name}.png", price=None)
               for name in ("camel", "navy")]

    async def load(url):
        return decode_image(png_bytes(pictures[url]))

    ranked = asyncio.run(rank_by_similarity(Image.new("RGB", (64, 64), navy), matches, SameLookEmbedder(), load))
    assert [r.match.title for r in ranked] == ["navy", "camel"]
    # The colour moves the score at most COLOR_WEIGHT / 2 from CLIP's 1.0.
    assert ranked[0].similarity == 1.0 and 0.94 <= ranked[1].similarity < 1.0
