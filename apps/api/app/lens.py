from dataclasses import dataclass

import httpx

UPLOAD_URL = "https://serpapi.com/image"
SEARCH_URL = "https://serpapi.com/search"
# Documented limits of the SerpApi Image API: 500 KB, jpg/png/webp, image_id expires after 10 minutes.
UPLOAD_MAX_BYTES = 500_000
NO_RESULTS_MARKER = "hasn't returned any results"


class SerpApiError(RuntimeError):
    pass


@dataclass(frozen=True)
class LensMatch:
    title: str
    link: str
    source: str | None
    thumbnail: str | None
    price: str | None


class LensClient:
    """Google Lens through SerpApi: upload the crop, then ask for visual matches.

    Each call to visual_matches spends one search of the monthly quota.
    """

    def __init__(self, api_key: str, country: str, hl: str, client: httpx.AsyncClient):
        self._api_key = api_key
        self._country = country
        self._hl = hl
        self._client = client

    async def visual_matches(self, jpeg: bytes) -> list[LensMatch]:
        upload = await self._request(
            "POST",
            UPLOAD_URL,
            data={"api_key": self._api_key},
            files={"image": ("crop.jpg", jpeg, "image/jpeg")},
        )
        if "image_id" not in upload:
            raise SerpApiError("SerpApi upload did not return an image_id")
        search = await self._request(
            "GET",
            SEARCH_URL,
            params={
                "engine": "google_lens",
                "image_id": upload["image_id"],
                "type": "visual_matches",
                "country": self._country,
                "hl": self._hl,
                "api_key": self._api_key,
            },
        )
        return [_parse_match(item) for item in search.get("visual_matches", []) if item.get("link")]

    async def _request(self, method: str, url: str, **kwargs) -> dict:
        try:
            response = await self._client.request(method, url, timeout=30, **kwargs)
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SerpApiError(f"SerpApi request failed: {exc}") from exc
        error = payload.get("error")
        if error and NO_RESULTS_MARKER in error:
            return {}
        if error or response.status_code != 200:
            raise SerpApiError(error or f"SerpApi answered HTTP {response.status_code}")
        return payload


def _parse_match(item: dict) -> LensMatch:
    # Product matches may carry a price, either as a string or as {"value": "$24.99", ...}.
    price = item.get("price")
    if isinstance(price, dict):
        price = price.get("value")
    return LensMatch(
        title=item.get("title", ""),
        link=item["link"],
        source=item.get("source"),
        thumbnail=item.get("thumbnail"),
        price=price,
    )
