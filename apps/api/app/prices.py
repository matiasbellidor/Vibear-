"""Fragrance prices from several shops, cheapest first, for the landing's "Potenciá tu outfit" part.

Two collectors, both cached so a page view never waits on a shop:
- Google Shopping through SerpApi (when SERPAPI_API_KEY is set): one call returns offers from many
  shops at once, in pesos for Argentina. Cached 24 h, so it spends ~30 searches a month per fragrance.
- The shops' own product pages: the price they publish as structured data (schema.org JSON-LD or
  product meta tags). Honest User-Agent, robots.txt respected, one request per page, cached 12 h.
  Shops that block bots or rate-limit simply drop out; the rest still show.
"""

import asyncio
import json
import re
import time
from dataclasses import asdict, dataclass
from urllib import robotparser
from urllib.parse import urlsplit

import httpx

SHOPPING_HOURS = 24
PAGES_HOURS = 12


@dataclass(frozen=True)
class Shop:
    name: str
    url: str  # a product page that publishes its price as structured data


@dataclass(frozen=True)
class Fragrance:
    id: str
    name: str
    house: str
    notes: str
    query: str  # what Google Shopping is asked
    must_include: tuple[str, ...]  # words a shopping result's title needs, so lookalikes don't count
    shops: tuple[Shop, ...]


FRAGRANCES = {
    "erba-pura": Fragrance(
        id="erba-pura",
        name="Erba Pura",
        house="Xerjoff",
        notes="Frutas cítricas, ámbar, vainilla y almizcle",
        query="Xerjoff Erba Pura perfume 100 ml",
        must_include=("erba", "pura"),
        shops=(
            Shop("Heinemann", "https://www.heinemann-shop.com/en/global/xerjoff/xerjoff-erba-pura-eau-de-parfum-100-ml/p/000000000001183906/"),
            Shop("NOSE Paris", "https://noseparis.com/en/erba-pura"),
            Shop("Parfums de France", "https://perfumedefrance.com/products/erba-pura-by-xerjoff"),
        ),
    ),
}


@dataclass(frozen=True)
class Offer:
    shop: str
    url: str
    price: float
    currency: str  # ISO 4217
    title: str
    source: str  # "shopping" or "page"


class PriceError(Exception):
    pass


def offers_from_page(html: str, shop: Shop) -> list[Offer]:
    """The prices a product page publishes: JSON-LD offers first, then product/og meta tags."""
    found = []
    for block in re.findall(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if not isinstance(item, dict) or "Product" not in str(item.get("@type")):
                continue
            raw = item.get("offers") or []
            for offer in raw if isinstance(raw, list) else [raw]:
                if not isinstance(offer, dict):
                    continue
                price = _number(offer.get("price") or offer.get("lowPrice"))
                currency = offer.get("priceCurrency")
                if price and currency and "OutOfStock" not in str(offer.get("availability", "")):
                    found.append(Offer(shop.name, shop.url, price, currency, str(item.get("name") or ""), "page"))
    if not found:
        price = re.search(r'property="(?:product|og):price:amount"\s+content="([^"]+)"', html)
        currency = re.search(r'property="(?:product|og):price:currency"\s+content="([A-Z]{3})"', html)
        if price and currency and _number(price.group(1)):
            found.append(Offer(shop.name, shop.url, _number(price.group(1)), currency.group(1), "", "page"))
    # A page can list several sizes (and samples): the full bottle is the dearest offer.
    return [max(found, key=lambda o: o.price)] if found else []


def offers_from_shopping(results: list[dict], fragrance: Fragrance) -> list[Offer]:
    offers = []
    for result in results:
        title = str(result.get("title", ""))
        price = _number(result.get("extracted_price"))
        if not price or not all(word in title.lower() for word in fragrance.must_include):
            continue
        link = result.get("product_link") or result.get("link") or ""
        offers.append(Offer(str(result.get("source") or "Tienda"), link, price, "ARS", title, "shopping"))
    return offers


def _number(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    if isinstance(value, str):
        cleaned = value.replace(",", "") if re.search(r"\.\d{2}$", value) else value.replace(".", "").replace(",", ".")
        try:
            number = float(re.sub(r"[^\d.]", "", cleaned))
        except ValueError:
            return None
        return number if number > 0 else None
    return None


class PriceBoard:
    """Collects and caches offers per fragrance. One collection at a time per fragrance."""

    def __init__(self, client: httpx.AsyncClient, user_agent: str, serpapi_key: str = ""):
        self._client = client
        self._ua = user_agent
        self._key = serpapi_key
        self._cache: dict[str, tuple[float, dict]] = {}
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def prices(self, fragrance_id: str) -> dict:
        fragrance = FRAGRANCES.get(fragrance_id)
        if fragrance is None:
            raise PriceError("Unknown fragrance")
        lock = self._locks.setdefault(fragrance_id, asyncio.Lock())
        async with lock:
            hours = SHOPPING_HOURS if self._key else PAGES_HOURS
            cached = self._cache.get(fragrance_id)
            if cached and time.time() - cached[0] < hours * 3600:
                return cached[1]
            shopping = self._shopping(fragrance) if self._key else _none()
            pages = asyncio.gather(*(self._page(shop) for shop in fragrance.shops))
            found_shopping, found_pages = await asyncio.gather(shopping, pages)
            offers = sorted(found_shopping + [o for found in found_pages for o in found], key=lambda o: (o.currency != "ARS", o.currency, o.price))
            board = {
                "fragrance": {k: v for k, v in asdict(fragrance).items() if k not in {"query", "must_include", "shops"}},
                "offers": [asdict(o) for o in offers],
                "checked": len(fragrance.shops) + (1 if self._key else 0),
                "updated_at": int(time.time()),
            }
            self._cache[fragrance_id] = (time.time(), board)
            return board

    async def _shopping(self, fragrance: Fragrance) -> list[Offer]:
        params = {"engine": "google_shopping", "q": fragrance.query, "gl": "ar", "hl": "es-419", "api_key": self._key}
        try:
            response = await self._client.get("https://serpapi.com/search.json", params=params, timeout=30)
            response.raise_for_status()
            return offers_from_shopping(response.json().get("shopping_results", []), fragrance)[:8]
        except (httpx.HTTPError, ValueError):
            return []

    async def _page(self, shop: Shop) -> list[Offer]:
        if not await self._allowed(shop.url):
            return []
        try:
            response = await self._client.get(shop.url, headers={"User-Agent": self._ua}, timeout=12, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPError:
            return []  # blocked, rate-limited or down: this shop sits this round out
        return offers_from_page(response.text, shop)

    async def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host not in self._robots:
            parser = robotparser.RobotFileParser()
            try:
                response = await self._client.get(f"{host}/robots.txt", headers={"User-Agent": self._ua}, timeout=8)
                parser.parse(response.text.splitlines() if response.status_code == 200 else [])
                self._robots[host] = parser
            except httpx.HTTPError:
                self._robots[host] = None
        parser = self._robots[host]
        return parser is None or parser.can_fetch(self._ua, url)


async def _none() -> list[Offer]:
    return []
