"""'Buscar en mi zona': turn what the user typed into coordinates, and list clothing shops nearby.

Free source only: OpenStreetMap's Nominatim (geocoding and shop search). Google Maps
links are accepted as input (long links carry coordinates; short maps.app.goo.gl links are
resolved by following their redirect, only through Google hosts).
"""

import math
import re
import time
import unicodedata
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, unquote_plus, urljoin, urlparse

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
SHORT_LINK_HOSTS = {"maps.app.goo.gl", "goo.gl"}
CACHE_SECONDS = 600
MAX_SHOPS = 40

_PLACE_DATA = re.compile(r"!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)")  # exact place in a /place/ link
_AT = re.compile(r"@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)")  # map centre in a Google Maps link
_PAIR = re.compile(r"\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*")
_GOOGLE = re.compile(r"(^|\.)google\.[a-z.]{2,6}$")


class PlaceError(RuntimeError):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Location:
    lat: float
    lng: float
    label: str


@dataclass(frozen=True)
class Shop:
    name: str
    lat: float
    lng: float
    distance_m: int
    address: str | None
    kind: str
    brand_match: bool  # sells a brand that appears in the user's search results


def _valid(lat: str, lng: str) -> tuple[float, float] | None:
    la, ln = float(lat), float(lng)
    return (la, ln) if -90 <= la <= 90 and -180 <= ln <= 180 else None


def parse_coordinates(text: str) -> tuple[float, float] | None:
    """Coordinates from "lat, lng" or from a Google Maps link, if it carries them."""
    decoded = unquote(text.strip())
    for pattern in (_PLACE_DATA, _AT):
        if match := pattern.search(decoded):
            return _valid(*match.groups())
    if match := _PAIR.fullmatch(decoded):
        return _valid(*match.groups())
    for key in ("q", "query", "ll", "destination", "center"):
        for value in parse_qs(urlparse(text.strip()).query).get(key, []):
            if match := _PAIR.fullmatch(value):
                return _valid(*match.groups())
    return None


def _place_name(url: str) -> str | None:
    parts = urlparse(url).path.split("/")
    if "place" in parts and parts.index("place") + 1 < len(parts):
        return unquote_plus(parts[parts.index("place") + 1]) or None
    query = parse_qs(urlparse(url).query).get("q", [])
    return query[0] if query else None


async def _resolve_short_link(url: str, client: httpx.AsyncClient) -> str:
    """Follow a maps.app.goo.gl link until it reaches a Google Maps URL (only requests short-link hosts)."""
    for _ in range(5):
        host = (urlparse(url).hostname or "").lower()
        if urlparse(url).scheme != "https" or not (host in SHORT_LINK_HOSTS or _GOOGLE.search(host)):
            raise PlaceError("That link does not lead to Google Maps", 422)
        if host not in SHORT_LINK_HOSTS:
            return url  # the full Google Maps URL: coordinates or the place name are in it
        try:
            response = await client.get(url, follow_redirects=False, timeout=10)
        except httpx.HTTPError as exc:
            raise PlaceError("Could not open the Google Maps link") from exc
        if not response.is_redirect:
            raise PlaceError("That short link does not lead anywhere", 422)
        url = urljoin(url, response.headers["location"])
    raise PlaceError("Too many redirects in the Google Maps link", 422)


async def geocode(text: str, client: httpx.AsyncClient) -> Location:
    text = text.strip()
    if coords := parse_coordinates(text):
        return Location(*coords, label=_place_name(text) or "Ubicación elegida")

    parsed = urlparse(text)
    if parsed.scheme in ("http", "https"):
        host = (parsed.hostname or "").lower()
        if host in SHORT_LINK_HOSTS:
            text = await _resolve_short_link(text, client)
            if coords := parse_coordinates(text):
                return Location(*coords, label="Ubicación del link")
            host = (urlparse(text).hostname or "").lower()
        if not _GOOGLE.search(host):
            raise PlaceError("Only Google Maps links are supported", 422)
        name = _place_name(text)
        if not name:
            raise PlaceError("That Google Maps link has no location", 422)
        text = name

    try:
        response = await client.get(
            NOMINATIM_URL,
            params={"q": text, "format": "jsonv2", "limit": 1, "accept-language": "es"},
            timeout=15,
        )
        results = response.json() if response.status_code == 200 else None
    except (httpx.HTTPError, ValueError) as exc:
        raise PlaceError("The geocoding service did not answer") from exc
    if results is None:
        raise PlaceError(f"The geocoding service answered HTTP {response.status_code}")
    if not results:
        raise PlaceError("Location not found", 404)
    first = results[0]
    return Location(float(first["lat"]), float(first["lon"]), label=first.get("display_name", text).split(",")[0])


def _normalize(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


def _mentions(text: str, word: str) -> bool:
    return bool(re.search(rf"\b{re.escape(word)}\b", text))


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6_371_000 * 2 * math.asin(math.sqrt(a))


_cache: dict[tuple[float, float, int], tuple[float, list]] = {}


async def nearby(lat: float, lng: float, radius: int, brands: list[str], client: httpx.AsyncClient) -> list[Shop]:
    """Clothing shops within `radius` metres, the ones selling a brand from `brands` first.

    Nominatim's category search ("clothes shop") bounded to a box around the point: one request,
    which respects its 1 request/second policy, cached for 10 minutes per ~100 m.
    """
    key = (round(lat, 3), round(lng, 3), radius)
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        results = cached[1]
    else:
        dlat = radius / 111_320
        dlng = radius / (111_320 * max(math.cos(math.radians(lat)), 0.01))
        params = {
            "q": "clothes shop", "format": "jsonv2", "limit": 40, "bounded": 1, "addressdetails": 1,
            "extratags": 1, "viewbox": f"{lng - dlng},{lat + dlat},{lng + dlng},{lat - dlat}",
        }
        try:
            response = await client.get(NOMINATIM_URL, params=params, timeout=20)
            results = response.json() if response.status_code == 200 else None
        except (httpx.HTTPError, ValueError) as exc:
            raise PlaceError("The shop map did not answer") from exc
        if results is None:
            raise PlaceError(f"The shop map answered HTTP {response.status_code}")
        _cache[key] = (time.time(), results)

    wanted = [b for b in (_normalize(brand) for brand in brands) if len(b) >= 3]
    shops = []
    for item in results:
        name = item.get("name")
        if not name or item.get("category") != "shop":
            continue
        slat, slng = float(item["lat"]), float(item["lon"])
        distance = _distance_m(lat, lng, slat, slng)
        if distance > radius:
            continue  # the box's corners reach further than the radius
        label = _normalize(f"{name} {(item.get('extratags') or {}).get('brand', '')}")
        short = _normalize(name)
        match = any(_mentions(label, b) or (len(short) >= 3 and _mentions(b, short)) for b in wanted)
        address = item.get("address") or {}
        street = " ".join(part for part in (address.get("road"), address.get("house_number")) if part)
        shops.append(
            Shop(
                name=name,
                lat=slat,
                lng=slng,
                distance_m=round(distance),
                address=street or None,
                kind=item.get("type", "clothes"),
                brand_match=match,
            )
        )
    shops.sort(key=lambda shop: (not shop.brand_match, shop.distance_m))
    return shops[:MAX_SHOPS]
