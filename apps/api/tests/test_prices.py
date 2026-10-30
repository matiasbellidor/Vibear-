import asyncio
import json

import httpx

from app.prices import FRAGRANCES, PriceBoard, Shop, offers_from_page, offers_from_shopping

SHOP = Shop("Tienda", "https://shop.test/erba-pura")


def ld(*offers, name="Xerjoff Erba Pura 100 ml"):
    product = {"@context": "https://schema.org", "@type": "Product", "name": name, "offers": list(offers)}
    return f'<script type="application/ld+json">{json.dumps(product)}</script>'


def test_the_full_bottle_price_comes_from_structured_data():
    html = ld(
        {"price": "7.00", "priceCurrency": "EUR", "availability": "https://schema.org/InStock"},  # a sample
        {"price": "165.00", "priceCurrency": "EUR", "availability": "https://schema.org/InStock"},
    )
    [offer] = offers_from_page(html, SHOP)
    assert (offer.shop, offer.price, offer.currency, offer.source) == ("Tienda", 165.0, "EUR", "page")


def test_out_of_stock_offers_and_pages_without_prices_give_nothing():
    assert offers_from_page(ld({"price": "99", "priceCurrency": "USD", "availability": "OutOfStock"}), SHOP) == []
    assert offers_from_page("<html>Erba Pura $245</html>", SHOP) == []


def test_meta_tags_are_the_fallback():
    html = '<meta property="product:price:amount" content="1.234,50"><meta property="product:price:currency" content="EUR">'
    assert offers_from_page(html, SHOP)[0].price == 1234.5


def test_shopping_results_must_name_the_fragrance():
    results = [
        {"title": "Xerjoff Erba Pura EDP 100ml", "source": "Perfumería A", "extracted_price": 450000, "product_link": "https://a"},
        {"title": "Perfume árabe inspirado", "source": "Otra", "extracted_price": 30000, "product_link": "https://b"},
    ]
    offers = offers_from_shopping(results, FRAGRANCES["erba-pura"])
    assert [(o.shop, o.price, o.currency) for o in offers] == [("Perfumería A", 450000.0, "ARS")]


def board_with(responses: dict[str, httpx.Response], key: str = "") -> tuple[PriceBoard, list[str]]:
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url).split("?")[0]
        calls.append(url)
        return responses.get(url, httpx.Response(404))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return PriceBoard(client, "VibearBot/test", key), calls


def test_offers_from_shops_and_shopping_cheapest_first_in_pesos_first():
    fragrance = FRAGRANCES["erba-pura"]
    first, second, third = fragrance.shops
    responses = {
        first.url: httpx.Response(200, text=ld({"price": "259.99", "priceCurrency": "EUR"})),
        second.url: httpx.Response(403),  # a shop that blocks bots just drops out
        "https://noseparis.com/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /*?"),
        "https://perfumedefrance.com/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /products/"),
        third.url: httpx.Response(200, text=ld({"price": "1", "priceCurrency": "USD"})),  # robots forbids: never read
        "https://serpapi.com/search.json": httpx.Response(200, json={"shopping_results": [
            {"title": "Erba Pura Xerjoff 100ml", "source": "Perfumería B", "extracted_price": 520000, "product_link": "https://b"},
            {"title": "Xerjoff Erba Pura EDP", "source": "Perfumería A", "extracted_price": 480000, "product_link": "https://a"},
        ]}),
    }
    board, calls = board_with(responses, key="test-key")
    result = asyncio.run(board.prices("erba-pura"))
    assert [(o["shop"], o["price"], o["currency"]) for o in result["offers"]] == [
        ("Perfumería A", 480000.0, "ARS"), ("Perfumería B", 520000.0, "ARS"), ("Heinemann", 259.99, "EUR")]
    assert third.url not in calls
    assert result["fragrance"]["name"] == "Erba Pura"

    # Cached: a second visit doesn't go back to the shops.
    before = len(calls)
    asyncio.run(board.prices("erba-pura"))
    assert len(calls) == before


def test_prices_endpoint(make_client):
    with make_client() as client:
        assert client.get("/v1/fragrances/no-existe/prices").status_code == 404
        assert client.get("/v1/fragrances/../etc/prices").status_code == 404
