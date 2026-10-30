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
from dataclasses import asdict, dataclass, replace
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


# Argentine perfume shops: niche ones on Tiendanube, big perfumeries and pharmacies on VTEX.
SHOP_SITES = {
    "Brume": "https://www.brumeperfumes.com.ar",
    "Oud Maison": "https://oudmaison.com.ar",
    "Neve": "https://www.neve.com.ar",
    "Esenzzia": "https://www.esenzzia.com.ar",
    "Pigmento": "https://www.perfumeriaspigmento.com.ar",
    "Farmalife": "https://www.farmalife.com.ar",
}


def at(shop: str, slug: str) -> Shop:
    """A product page: Tiendanube's /productos/<slug>/, VTEX's /<slug>/p."""
    site = SHOP_SITES[shop]
    return Shop(shop, f"{site}/{slug}/p" if shop in ("Pigmento", "Farmalife") else f"{site}/productos/{slug}/")


def _fragrance(id: str, name: str, house: str, notes: str, size_ml: int, must_include: tuple[str, ...], *shops: Shop) -> Fragrance:
    return Fragrance(id, name, house, notes, f"{house} {name} perfume {size_ml} ml", must_include, size_ml, shops)


# The catalogue, featured first: what these Argentine shops had in stock, full bottles.
FRAGRANCES = {
    f.id: f
    for f in (
        _fragrance("erba-pura", "Erba Pura", "Xerjoff", "Frutas cítricas, ámbar, vainilla y almizcle", 100, ("erba", "pura"),
                   at("Brume", "xerjoff-erba-pura-edp-100-ml"), at("Oud Maison", "xerjoff-erba-pura-edp"),
                   at("Neve", "xerjoff-erba-pura"), at("Esenzzia", "xerjoff-erba-pura-100ml")),
        _fragrance("le-male-elixir", "Le Male Elixir", "Jean Paul Gaultier", "Lavanda, miel, tonka y tabaco", 125,
                   ("male", "elixir"), at("Pigmento", "jean-paul-gaultier-le-male-elixir-parfum"),
                   at("Farmalife", "jean-paul-gaultier-le-male-elixir-men-edp-x-125ml--3030600331")),
        _fragrance("good-girl", "Good Girl", "Carolina Herrera", "Tuberosa, jazmín, tonka y cacao", 80, ("good", "girl"),
                   at("Pigmento", "good-girl-edp"), at("Farmalife", "carolina-herrera-goodgirl-edp-x-80ml--3002142079")),
        _fragrance("naxos", "Naxos", "Xerjoff", "Tabaco, miel y lavanda", 100, ("naxos",),
                   at("Oud Maison", "xerjoff-naxos-edp"), at("Neve", "xerjoff-1891-naxos")),
        _fragrance("erba-gold", "Erba Gold", "Xerjoff", "Cítrico, frutal y ambarado", 100, ("erba", "gold"),
                   at("Brume", "xerjoff-erba-gold-edp-100-ml"), at("Neve", "xerjoff-erba-gold"),
                   at("Esenzzia", "xerjoff-erba-gold-100ml")),
        _fragrance("baccarat-rouge-540", "Baccarat Rouge 540", "Maison Francis Kurkdjian", "Azafrán, ámbar y cedro", 70,
                   ("baccarat", "540"), at("Oud Maison", "maison-francis-kurkdjian-baccarat-rouge-540-edp")),
        _fragrance("bianco-latte", "Bianco Latte", "Giardini di Toscana", "Leche, caramelo y vainilla", 100, ("bianco", "latte"),
                   at("Oud Maison", "giardini-di-toscana-bianco-latte-edp"), at("Neve", "giardini-di-toscana-bianco-latte")),
        _fragrance("gris-charnel", "Gris Charnel", "BDK Parfums", "Higo, cardamomo y té negro", 100, ("gris", "charnel"),
                   at("Oud Maison", "bdk-parfums-gris-charnel-edp")),
        _fragrance("arabians-tonka", "Arabians Tonka", "Montale", "Tonka, azafrán y oud", 100, ("arabians", "tonka"),
                   at("Oud Maison", "montale-arabians-tonka-edp"), at("Neve", "montale-arabians-tonka")),
        _fragrance("by-the-fireplace", "By the Fireplace", "Maison Margiela", "Castaña, vainilla y humo de leña", 100,
                   ("fireplace",), at("Neve", "maison-margiela-by-the-fireplace")),
        _fragrance("instant-crush", "Instant Crush", "Mancera", "Azafrán, ámbar y vainilla", 120, ("instant", "crush"),
                   at("Oud Maison", "mancera-instant-crush-edp")),
        _fragrance("kirke", "Kirke", "Tiziana Terenzi", "Maracuyá, durazno y almizcle", 100, ("kirke",),
                   at("Neve", "tiziana-terenzi-kirke")),
        _fragrance("beach-walk", "Beach Walk", "Maison Margiela", "Bergamota, coco y almizcle", 100, ("beach", "walk"),
                   at("Neve", "maison-margiela-beach-walk")),
        _fragrance("althair", "Althair", "Parfums de Marly", "Vainilla, canela y praliné", 125, ("althair",),
                   at("Neve", "parfums-de-marly-althair")),
    )
}


@dataclass(frozen=True)
class Offer:
    shop: str
    url: str
    price: float
    currency: str  # ISO 4217
    title: str
    source: str  # "shopping" or "page"
    image: str | None = None  # the shop's own product photo, hotlinked by the browser, never stored


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
    return [replace(max(bottles, key=lambda o: o.price), image=_image(html))] if bottles else []


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


def vtex_api(url: str) -> str:
    """A VTEX product page's entry in the shop's public catalogue API (what its own pages read)."""
    parts = urlsplit(url)
    slug = parts.path.strip("/").removesuffix("/p")
    return f"{parts.scheme}://{parts.netloc}/api/catalog_system/pub/products/search/{slug}/p"


def offers_from_vtex(products: list, shop: Shop, fragrance: Fragrance) -> list[Offer]:
    """A VTEX product: one item (SKU) per size, each with its price, stock and photo. VTEX states no
    currency here; these are Argentine stores, whose pages publish the same prices in ARS."""
    found = []
    for product in products if isinstance(products, list) else []:
        name = str(product.get("productName") or "")
        if not _is_the_bottle(name, fragrance):
            continue
        for item in product.get("items", []):
            offer = (item.get("sellers") or [{}])[0].get("commertialOffer", {})
            price = _number(offer.get("Price"))
            if not price or not offer.get("AvailableQuantity"):
                continue
            size = _size(str(item.get("name") or "")) or _size(name)
            if size not in (None, fragrance.size_ml):
                continue
            images = item.get("images") or [{}]
            found.append(Offer(shop.name, shop.url, price, CURRENCY, name, "page", images[0].get("imageUrl")))
    return [max(found, key=lambda o: o.price)] if found else []


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


def _image(html: str) -> str | None:
    """The product photo the shop publishes for sharing (og:image), https only."""
    match = re.search(r'property="og:image:secure_url"\s+content="(https://[^"]+)"', html) or re.search(
        r'property="og:image"\s+content="(https?://[^"]+)"', html)
    return match.group(1).replace("http://", "https://", 1) if match else None


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
    """Collects and caches offers per fragrance: the shops' pages (12 h) and, only where asked,
    Google Shopping (24 h; it spends SerpApi quota, which the scanner needs more). One collection at
    a time per fragrance, and at most two pages at a time per shop, so a cold catalogue never
    hammers a store."""

    def __init__(self, client: httpx.AsyncClient, user_agent: str, serpapi_key: str = ""):
        self._client = client
        self._ua = user_agent
        self._key = serpapi_key
        self._cache: dict[str, tuple[float, list[Offer]]] = {}
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._hosts: dict[str, asyncio.Semaphore] = {}

    async def catalogue(self) -> dict:
        """Every fragrance with its shops' prices (no Google Shopping: twelve searches a day add up)."""
        items = await asyncio.gather(*(self.prices(fragrance_id, shopping=False) for fragrance_id in FRAGRANCES))
        return {"items": items, "updated_at": min(item["updated_at"] for item in items)}

    async def prices(self, fragrance_id: str, shopping: bool = True) -> dict:
        fragrance = FRAGRANCES.get(fragrance_id)
        if fragrance is None:
            raise PriceError("Unknown fragrance")
        found, updated = await self._cached(f"pages:{fragrance_id}", PAGES_HOURS, lambda: self._pages(fragrance))
        checked = len(fragrance.shops)
        if shopping and self._key:
            more, then = await self._cached(f"shopping:{fragrance_id}", SHOPPING_HOURS, lambda: self._shopping(fragrance))
            found, updated, checked = found + more, min(updated, then), checked + 1
        offers = sorted(plausible(found), key=lambda o: o.price)
        # The shops' photos first: they're the bottle on white, which the page cuts out.
        photos = [o.image for o in offers if o.image and o.source == "page"] + [o.image for o in offers if o.image]
        return {
            "fragrance": {k: v for k, v in asdict(fragrance).items() if k not in {"query", "must_include", "shops"}},
            "offers": [asdict(o) for o in offers],
            "image": photos[0] if photos else None,
            "checked": checked,
            "updated_at": updated,
        }

    async def _cached(self, key: str, hours: int, collect) -> tuple[list[Offer], int]:
        async with self._locks.setdefault(key, asyncio.Lock()):
            cached = self._cache.get(key)
            if cached and time.time() - cached[0] < hours * 3600:
                return cached[1], int(cached[0])
            offers = await collect()
            self._cache[key] = (time.time(), offers)
            return offers, int(self._cache[key][0])

    async def _pages(self, fragrance: Fragrance) -> list[Offer]:
        found = await asyncio.gather(*(self._page(shop, fragrance) for shop in fragrance.shops))
        return [offer for offers in found for offer in offers]

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
        vtex = shop.url.endswith("/p")
        url = vtex_api(shop.url) if vtex else shop.url
        if not await self._allowed(url):
            return []
        async with self._hosts.setdefault(urlsplit(url).netloc, asyncio.Semaphore(2)):
            try:
                response = await self._client.get(url, headers={"User-Agent": self._ua}, timeout=12, follow_redirects=True)
                response.raise_for_status()
                if vtex:
                    return offers_from_vtex(response.json(), shop, fragrance)
            except (httpx.HTTPError, ValueError):
                return []  # blocked, rate-limited or down: this shop sits this round out
        return offers_from_page(response.text, shop, fragrance)

    async def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = f"{parts.scheme}://{parts.netloc}"
        async with self._locks.setdefault(f"robots:{host}", asyncio.Lock()):  # one robots.txt read per shop
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
