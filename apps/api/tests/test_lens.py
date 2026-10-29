import asyncio

import httpx
import pytest

from app.lens import LensClient, SerpApiError


def lens_with(search_payload, search_status=200):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/image":
            seen["upload"] = request.content
            return httpx.Response(200, json={"message": "Image uploaded successfully.", "image_id": "img123"})
        seen["params"] = dict(request.url.params)
        return httpx.Response(search_status, json=search_payload)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return LensClient("key", "ar", "es-419", client), seen


def test_uploads_crop_then_searches_by_image_id():
    lens, seen = lens_with(
        {
            "visual_matches": [
                {
                    "position": 1,
                    "title": "Campera de jean",
                    "link": "https://shop.test/campera",
                    "source": "Shop",
                    "thumbnail": "https://img.test/1.jpg",
                    "price": {"value": "$45.000", "extracted_value": 45000, "currency": "$"},
                },
                {"position": 2, "title": "Sin link"},
            ]
        }
    )
    matches = asyncio.run(lens.visual_matches(b"jpeg-bytes"))

    assert b"jpeg-bytes" in seen["upload"]
    assert seen["params"]["image_id"] == "img123"
    assert seen["params"]["engine"] == "google_lens"
    assert seen["params"]["type"] == "visual_matches"
    assert (seen["params"]["country"], seen["params"]["hl"]) == ("ar", "es-419")
    assert len(matches) == 1
    assert matches[0].price == "$45.000"


def test_no_results_is_an_empty_list():
    lens, _ = lens_with({"error": "Google Lens hasn't returned any results for this query."})
    assert asyncio.run(lens.visual_matches(b"x")) == []


def test_api_errors_raise():
    lens, _ = lens_with({"error": "Invalid API key."}, search_status=401)
    with pytest.raises(SerpApiError, match="Invalid API key"):
        asyncio.run(lens.visual_matches(b"x"))
