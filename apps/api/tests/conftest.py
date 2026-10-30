"""Fakes for the models and SerpApi, so tests run in seconds with no network, torch or API key."""

import io

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.lens import LensMatch
from app.main import create_app

RED, GRAY, BLUE = (200, 30, 30), (128, 128, 128), (30, 30, 200)


def png_bytes(color, size=(300, 450)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "PNG")
    return buffer.getvalue()


class FakeDetector:
    def __init__(self, detections):
        self.detections = detections

    def detect(self, image):
        return self.detections


class FakeEmbedder:
    """Embeds an image as its normalised mean colour: same colour -> similarity 1.0."""

    def embed(self, images):
        vectors = np.array([np.asarray(img, dtype=float).reshape(-1, 3).mean(axis=0) for img in images])
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


class FakeLens:
    def __init__(self, matches):
        self.matches = matches
        self.calls = 0

    async def visual_matches(self, jpeg):
        self.calls += 1
        return self.matches


def match(name, thumbnail, link=None):
    return LensMatch(title=name, link=link or f"https://tienda.com.ar/{name}", source="Shop", thumbnail=thumbnail, price=None)


# Lens order is deliberately not the similarity order, so the test proves the re-rank.
LENS_MATCHES = [
    match("blue", "https://img.test/blue.png"),
    match("broken", "https://img.test/missing.png"),
    match("red", "https://img.test/red.png"),
    match("gray", "https://img.test/gray.png"),
]


def thumbnails_transport() -> httpx.MockTransport:
    images = {f"https://img.test/{name}.png": png_bytes(color) for name, color in
              [("red", RED), ("gray", GRAY), ("blue", BLUE)]}

    def handler(request: httpx.Request) -> httpx.Response:
        data = images.get(str(request.url))
        return httpx.Response(200, content=data) if data else httpx.Response(404)

    return httpx.MockTransport(handler)


@pytest.fixture
def make_client(tmp_path):
    def _make(detections=(), lens=None, describer=None, **overrides) -> TestClient:
        settings = Settings(_env_file=None, data_dir=tmp_path, **overrides)
        app = create_app(
            settings,
            detector=FakeDetector(list(detections)),
            embedder=FakeEmbedder(),
            describer=describer,
            lens=lens,
            client=httpx.AsyncClient(transport=thumbnails_transport()),
        )
        return TestClient(app)

    return _make
