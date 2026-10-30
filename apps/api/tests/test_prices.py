import asyncio
import json
from urllib.parse import urlsplit

import httpx

from app.prices import (
    FRAGRANCES, Offer, PriceBoard, Shop, offers_from_page, offers_from_shopping, offers_from_vtex, plausible, vtex_api,
)

SHOP = Shop("Tienda", "https://tienda.com.ar/erba-pura")
ERBA = FRAGRANCES["erba-pura"]


def ld(*offers, name="Xerjoff Erba Pura 100 ml"):
    product = {"@context": "https://schema.org", "@type": "Product", "name": name, "offers": list(offers)}
    return f'<script type="application/ld+json">{json.dumps(product)}</script>'


def tiendanube(title, *variants, image="http://cdn.test/erba-pura-640-0.webp"):
    """A Tiendanube product page: the title, the photo it shares, and each variant as the store embeds it."""
    rows = [
        {"option0": size, "price_number": price, "price_long": f"${price:,} ARS", "available": available}
        for size, price, available in variants
    ]
    return (f'<title>{title}</title><meta property="og:image" content="{image}" />\n'
            f"<script>\n  LS.variants = {json.dumps(rows)};\n</script>")


def test_tiendanube_pages_give_the_100_ml_bottle_in_stock():
    html = tiendanube("Xerjoff Erba Pura EDP | Oud Maison", ("50ml", 420000, True), ("100ml", 585000, True))
    [offer] = offers_from_page(html, SHOP, ERBA)
    assert (offer.shop, offer.price, offer.currency, offer.source) == ("Tienda", 585000.0, "ARS", "page")
    assert offer.image == "https://cdn.test/erba-pura-640-0.webp"  # the shop's photo, always https

    sold_out = tiendanube("Xerjoff Erba Pura", ("50ml", 488000, True), ("100ml", 601000, False))
    assert offers_from_page(sold_out, SHOP, ERBA) == []  # only the 50 ml left: not the same bottle


def test_related_products_on_the_page_are_ignored():
    html = ld({"price": "584500", "priceCurrency": "ARS"}, name="Xerjoff Erba Gold EDP (100 ML)") + ld(
        {"price": "41800", "priceCurrency": "ARS"}, name="Decant - Xerjoff Erba Pura EDP") + ld(
        {"price": "517600", "priceCurrency": "ARS", "availability": "https://schema.org/InStock"})
    [offer] = offers_from_page(html, SHOP, ERBA)
    assert offer.price == 517600.0


def test_prices_abroad_never_count():
    assert offers_from_page(ld({"price": "259.99", "priceCurrency": "EUR"}), SHOP, ERBA) == []
    assert offers_from_page(ld({"price": "820000", "priceCurrency": "COP"}), SHOP, ERBA) == []
    meta = '<meta property="product:price:amount" content="290.00"><meta property="product:price:currency" content="USD">'
    assert offers_from_page(f"<title>Erba Pura</title>{meta}", SHOP, ERBA) == []


def test_out_of_stock_offers_and_pages_without_prices_give_nothing():
    assert offers_from_page(ld({"price": "99", "priceCurrency": "ARS", "availability": "OutOfStock"}), SHOP, ERBA) == []
    assert offers_from_page("<html>Erba Pura $245</html>", SHOP, ERBA) == []


def test_meta_tags_are_the_fallback():
    html = ('<title>Xerjoff Erba Pura 100 ml</title><meta property="product:price:amount" content="1.234.500,00">'
            '<meta property="product:price:currency" content="ARS">')
    assert offers_from_page(html, SHOP, ERBA)[0].price == 1234500.0


def test_shopping_results_must_be_the_bottle():
    results = [
        {"title": "Xerjoff Erba Pura EDP 100ml", "source": "Perfumería A", "extracted_price": 450000, "product_link": "https://a"},
        {"title": "Perfume árabe inspirado en Erba Pura", "source": "Otra", "extracted_price": 30000, "product_link": "https://b"},
        {"title": "Decant Erba Pura 10 ml", "source": "Otra", "extracted_price": 28000, "product_link": "https://c"},
        {"title": "Xerjoff Erba Pura 50 ml", "source": "Otra", "extracted_price": 380000, "product_link": "https://d"},
    ]
    offers = offers_from_shopping(results, ERBA)
    assert [(o.shop, o.price, o.currency) for o in offers] == [("Perfumería A", 450000.0, "ARS")]


def test_a_price_far_below_the_rest_is_not_the_original():
    offers = [Offer(name, "https://x", price, "ARS", "Erba Pura 100 ml", "page")
              for name, price in [("A", 517600), ("B", 585000), ("C", 601000), ("Copia", 59000)]]
    assert [o.shop for o in plausible(offers)] == ["A", "B", "C"]


def board_with(responses: dict[str, httpx.Response], key: str = "") -> tuple[PriceBoard, list[str]]:
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url).split("?")[0]
        calls.append(url)
        return responses.get(url, httpx.Response(404))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return PriceBoard(client, "VibearBot/test", key), calls


def test_offers_from_argentine_shops_and_shopping_cheapest_first():
    first, second, third, fourth = ERBA.shops
    responses = {
        first.url: httpx.Response(200, text=tiendanube("Xerjoff Erba Pura EDP (100 ML)", ("", 517600, True))),
        second.url: httpx.Response(403),  # a shop that blocks bots just drops out
        "https://www.neve.com.ar/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /productos/"),
        third.url: httpx.Response(200, text=tiendanube("Erba Pura", ("100ml", 1, True))),  # robots forbids: never read
        fourth.url: httpx.Response(200, text=tiendanube("Xerjoff Erba Pura 100ml", ("100", 634115, True))),
        "https://serpapi.com/search.json": httpx.Response(200, json={"shopping_results": [
            {"title": "Erba Pura Xerjoff 100ml", "source": "Perfumería B", "extracted_price": 560000, "product_link": "https://b"},
            {"title": "Xerjoff Erba Pura EDP", "source": "Perfumería A", "extracted_price": 480000, "product_link": "https://a"},
        ]}),
    }
    board, calls = board_with(responses, key="test-key")
    result = asyncio.run(board.prices("erba-pura"))
    assert [(o["shop"], o["price"], o["currency"]) for o in result["offers"]] == [
        ("Perfumería A", 480000.0, "ARS"), (first.name, 517600.0, "ARS"),
        ("Perfumería B", 560000.0, "ARS"), (fourth.name, 634115.0, "ARS")]
    assert third.url not in calls
    assert result["fragrance"]["name"] == "Erba Pura"
    assert result["image"] == "https://cdn.test/erba-pura-640-0.webp"

    # Cached: a second visit doesn't go back to the shops.
    before = len(calls)
    asyncio.run(board.prices("erba-pura"))
    assert len(calls) == before


def vtex_product(name, *items):
    """A VTEX catalogue answer: one product, one item (SKU) per size."""
    return [{"productName": name, "items": [
        {"name": size, "images": [{"imageUrl": f"https://cdn.test/{size}.jpg"}],
         "sellers": [{"commertialOffer": {"Price": price, "AvailableQuantity": stock}}]}
        for size, price, stock in items]}]


def test_vtex_shops_give_the_right_size_in_stock():
    male = FRAGRANCES["le-male-elixir"]
    shop = male.shops[0]
    product = vtex_product("Le Male Elixir Parfum", ("200 Ml", 469500, 99), ("125 Ml", 375550, 100), ("75 Ml", 319150, 100))
    [offer] = offers_from_vtex(product, shop, male)
    assert (offer.price, offer.currency, offer.image) == (375550.0, "ARS", "https://cdn.test/125 Ml.jpg")
    assert offers_from_vtex(vtex_product("Le Male Elixir Parfum", ("125 Ml", 375550, 0)), shop, male) == []  # no stock
    assert vtex_api(shop.url) == "https://www.perfumeriaspigmento.com.ar/api/catalog_system/pub/products/search/jean-paul-gaultier-le-male-elixir-parfum/p"


def test_the_catalogue_reads_every_fragrance_from_the_shops_without_spending_searches():
    def page(fragrance, shop):
        if shop.url.endswith("/p"):
            return httpx.Response(200, json=[{"productName": f"{fragrance.house} {fragrance.name}", "items": [
                {"name": f"{fragrance.size_ml} Ml", "images": [{"imageUrl": f"https://cdn.test/{fragrance.id}.webp"}],
                 "sellers": [{"commertialOffer": {"Price": 500000, "AvailableQuantity": 3}}]}]}])
        return httpx.Response(200, text=tiendanube(f"{fragrance.house} {fragrance.name} {fragrance.size_ml} ml",
                                                   ("", 500000, True), image=f"https://cdn.test/{fragrance.id}.webp"))

    responses = {(vtex_api(shop.url) if shop.url.endswith("/p") else shop.url): page(f, shop)
                 for f in FRAGRANCES.values() for shop in f.shops}
    board, calls = board_with(responses, key="test-key")
    catalogue = asyncio.run(board.catalogue())
    assert [item["fragrance"]["id"] for item in catalogue["items"]] == list(FRAGRANCES)
    assert all(item["offers"] and item["image"] == f"https://cdn.test/{item['fragrance']['id']}.webp"
               for item in catalogue["items"])
    assert "https://serpapi.com/search.json" not in calls
    pages = [url for url in calls if not url.endswith("/robots.txt")]
    assert len(pages) == len(set(pages))  # each shop page read once
    shops = {urlsplit(s.url).netloc for f in FRAGRANCES.values() for s in f.shops}
    assert len([url for url in calls if url.endswith("/robots.txt")]) == len(shops)  # one robots.txt per shop


def test_every_shop_is_argentine():
    for fragrance in FRAGRANCES.values():
        assert all(".com.ar/" in shop.url for shop in fragrance.shops)


def test_prices_endpoint(make_client):
    with make_client() as client:
        assert client.get("/v1/fragrances/no-existe/prices").status_code == 404
        assert client.get("/v1/fragrances/../etc/prices").status_code == 404
