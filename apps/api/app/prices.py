"""Fragrance prices from Argentine shops, in pesos, cheapest first, for the landing's "Potenciá tu outfit".

Vibear works with Argentina only: shops that sell here and prices in ARS. Anything else is dropped.
Two collectors, both cached so a page view never waits on a shop:
- Google Shopping through SerpApi (when SERPAPI_API_KEY is set), asked from Argentina: one call
  returns offers from many shops at once. Cached 24 h, so it spends ~30 searches a month per fragrance.
- The shops' own product pages: the price they publish as data in the page (Tiendanube's variants,
  which most Argentine perfume shops run on, or schema.org JSON-LD and product meta tags). Honest
  User-Agent, robots.txt respected, one request per page, cached 12 h. Shops that block bots or
  rate-limit simply drop out; the rest still show.
Only the full bottle counts (no decants, samples or "inspired by" copies), and prices far below the
rest are dropped too: at half the going price, it isn't the original.
"""

import asyncio
import json
import re
import statistics
import time
from dataclasses import asdict, dataclass
from urllib import robotparser
from urllib.parse import urlsplit

import httpx

SHOPPING_HOURS = 24
PAGES_HOURS = 12
CURRENCY = "ARS"
# Listings that aren't the bottle itself, whatever their title says next.
NOT_THE_BOTTLE = ("decant", "muestra", "sample", "miniatura", "inspirad", "replica", "réplica", "alternativa", "similar a")
SIZE = re.compile(r"(\d{2,3})\s*ml\b", re.I)


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
    must_include: tuple[str, ...]  # words a listing's title needs, so lookalikes don't count
    size_ml: int  # the bottle compared across shops
    shops: tuple[Shop, ...]  # Argentine shops only


FRAGRANCES = {
    "erba-pura": Fragrance(
        id="erba-pura",
        name="Erba Pura",
        house="Xerjoff",
        notes="Frutas cítricas, ámbar, vainilla y almizcle",
        query="Xerjoff Erba Pura perfume 100 ml",
        must_include=("erba", "pura"),
        size_ml=100,
        shops=(
            Shop("Brume", "https://www.brumeperfumes.com.ar/productos/xerjoff-erba-pura-edp-100-ml/"),
            Shop("Oud Maison", "https://oudmaison.com.ar/productos/xerjoff-erba-pura-edp/"),
            Shop("Neve", "https://www.neve.com.ar/productos/xerjoff-erba-pura/"),
            Shop("Esenzzia", "https://www.esenzzia.com.ar/productos/xerjoff-erba-pura-100ml/"),
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


def offers_from_page(html: str, shop: Shop, fragrance: Fragrance) -> list[Offer]:
    """The fragrance's price on a shop's product page: the full bottle, in pesos, in stock.

    Product pages also carry related products ("you may also like"), so only a product named like
    the fragrance counts. Each candidate is (offer, size in ml or None when the page doesn't say).
    """
    found = _tiendanube(html, shop, fragrance) or _json_ld(html, shop, fragrance) or _meta(html, shop, fragrance)
    bottles = [offer for offer, size in found if size in (None, fragrance.size_ml)]
    # Sizes the page doesn't name leave samples possible: the full bottle is the dearest of them.
    return [max(bottles, key=lambda o: o.price)] if bottles else []


def _tiendanube(html: str, shop: Shop, fragrance: Fragrance) -> list[tuple[Offer, int | None]]:
    """Tiendanube stores embed each variant (size) of the product as `LS.variants = [...]`."""
    match = re.search(r"LS\.variants\s*=\s*(\[.*?\]);\s*$", html, re.S | re.M)
    title = _title(html)
    if not match or not _is_the_bottle(title, fragrance):
        return []
    try:
        variants = json.loads(match.group(1))
    except ValueError:
        return []
    found = []
    for variant in variants:
        if not isinstance(variant, dict) or not variant.get("available"):
            continue
        price = _number(variant.get("price_number"))
        if not price or not str(variant.get("price_long", "")).endswith(CURRENCY):
            continue
        options = [str(variant.get(f"option{i}") or "") for i in range(3)]
        sizes = [int(m.group(1)) for o in options if (m := re.fullmatch(r"\s*(\d{2,3})\s*(?:ml)?\s*", o, re.I))]
        found.append((Offer(shop.name, shop.url, price, CURRENCY, title, "page"), sizes[0] if sizes else _size(title)))
    return found


def _json_ld(html: str, shop: Shop, fragrance: Fragrance) -> list[tuple[Offer, int | None]]:
    found = []
    for block in re.findall(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            name = str(item.get("name") or "") if isinstance(item, dict) else ""
            if "Product" not in str(item.get("@type") if isinstance(item, dict) else "") or not _is_the_bottle(name, fragrance):
                continue
            raw = item.get("offers") or []
            for offer in raw if isinstance(raw, list) else [raw]:
                if not isinstance(offer, dict) or offer.get("priceCurrency") != CURRENCY:
                    continue
                price = _number(offer.get("price") or offer.get("lowPrice"))
                if price and "OutOfStock" not in str(offer.get("availability", "")):
                    size = _size(str(offer.get("name") or "")) or _size(name)
                    found.append((Offer(shop.name, shop.url, price, CURRENCY, name, "page"), size))
    return found


def _meta(html: str, shop: Shop, fragrance: Fragrance) -> list[tuple[Offer, int | None]]:
    price = re.search(r'property="(?:product|og):price:amount"\s+content="([^"]+)"', html)
    currency = re.search(r'property="(?:product|og):price:currency"\s+content="([A-Z]{3})"', html)
    title = _title(html)
    if not (price and currency and currency.group(1) == CURRENCY and _number(price.group(1))):
        return []
    if not _is_the_bottle(title, fragrance):
        return []
    return [(Offer(shop.name, shop.url, _number(price.group(1)), CURRENCY, title, "page"), _size(title))]


def offers_from_shopping(results: list[dict], fragrance: Fragrance) -> list[Offer]:
    """Google Shopping results asked from Argentina (gl=ar): prices in pesos."""
    offers = []
    for result in results:
        title = str(result.get("title", ""))
        price = _number(result.get("extracted_price"))
        if not price or not _is_the_bottle(title, fragrance) or _size(title) not in (None, fragrance.size_ml):
            continue
        link = result.get("product_link") or result.get("link") or ""
        offers.append(Offer(str(result.get("source") or "Tienda"), link, price, CURRENCY, title, "shopping"))
    return offers


def plausible(offers: list[Offer]) -> list[Offer]:
    """Drop prices under half the median: at that price it's a copy or a sample, not the original."""
    if len(offers) < 3:
        return offers
    floor = statistics.median(o.price for o in offers) / 2
    return [o for o in offers if o.price >= floor]


def _is_the_bottle(title: str, fragrance: Fragrance) -> bool:
    lowered = title.lower()
    return all(word in lowered for word in fragrance.must_include) and not any(word in lowered for word in NOT_THE_BOTTLE)


def _size(text: str) -> int | None:
    match = SIZE.search(text)
    return int(match.group(1)) if match else None


def _title(html: str) -> str:
    match = re.search(r'property="og:title"\s+content="([^"]*)"', html) or re.search(r"<title>(.*?)</title>", html, re.S)
    return match.group(1).strip() if match else ""


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
            pages = asyncio.gather(*(self._page(shop, fragrance) for shop in fragrance.shops))
            found_shopping, found_pages = await asyncio.gather(shopping, pages)
            offers = sorted(plausible(found_shopping + [o for found in found_pages for o in found]), key=lambda o: o.price)
            board = {
                "fragrance": {k: v for k, v in asdict(fragrance).items() if k not in {"query", "must_include", "shops"}},
                "offers": [asdict(o) for o in offers],
                "checked": len(fragrance.shops) + (1 if self._key else 0),
                "updated_at": int(time.time()),
            }
            self._cache[fragrance_id] = (time.time(), board)
            return board

    async def _shopping(self, fragrance: Fragrance) -> list[Offer]:
        params = {
            "engine": "google_shopping", "q": fragrance.query, "google_domain": "google.com.ar",
            "gl": "ar", "hl": "es-419", "api_key": self._key,
        }
        try:
            response = await self._client.get("https://serpapi.com/search.json", params=params, timeout=30)
            response.raise_for_status()
            return offers_from_shopping(response.json().get("shopping_results", []), fragrance)[:8]
        except (httpx.HTTPError, ValueError):
            return []

    async def _page(self, shop: Shop, fragrance: Fragrance) -> list[Offer]:
        if not await self._allowed(shop.url):
            return []
        try:
            response = await self._client.get(shop.url, headers={"User-Agent": self._ua}, timeout=12, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPError:
            return []  # blocked, rate-limited or down: this shop sits this round out
        return offers_from_page(response.text, shop, fragrance)

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
