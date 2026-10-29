import asyncio

import httpx
import pytest

from app import places
from app.places import PlaceError, geocode, nearby, parse_coordinates


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("-34.5881, -58.4302", (-34.5881, -58.4302)),
        ("https://www.google.com/maps/@-34.5881,-58.4302,15z", (-34.5881, -58.4302)),
        # A place link: the exact place (!3d!4d) wins over the map centre (@).
        ("https://www.google.com/maps/place/Palermo/@-34.58,-58.43,15z/data=!3d-34.5889!4d-58.4199", (-34.5889, -58.4199)),
        ("https://maps.google.com/?q=-34.6037,-58.3816", (-34.6037, -58.3816)),
        ("https://www.google.com/maps/dir/?api=1&destination=-34.6,-58.4", (-34.6, -58.4)),
        ("Palermo, Buenos Aires", None),
        ("123.4, 999", None),
    ],
)
def test_parse_coordinates(text, expected):
    assert parse_coordinates(text) == expected


def client_for(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_geocode_text_uses_nominatim():
    def handler(request):
        assert request.url.host == "nominatim.openstreetmap.org"
        assert request.url.params["q"] == "Palermo Soho"
        return httpx.Response(200, json=[{"lat": "-34.5889", "lon": "-58.4306", "display_name": "Palermo Soho, CABA"}])

    location = asyncio.run(geocode("Palermo Soho", client_for(handler)))
    assert (location.lat, location.lng, location.label) == (-34.5889, -58.4306, "Palermo Soho")


def test_geocode_short_google_link_follows_redirects_through_google_only():
    def handler(request):
        if request.url.host == "maps.app.goo.gl":
            return httpx.Response(302, headers={"location": "https://www.google.com/maps/place/X/@-34.6,-58.38,17z"})
        raise AssertionError("unexpected request")

    location = asyncio.run(geocode("https://maps.app.goo.gl/abc123", client_for(handler)))
    assert (location.lat, location.lng) == (-34.6, -58.38)

    def evil(request):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest"})

    with pytest.raises(PlaceError):
        asyncio.run(geocode("https://maps.app.goo.gl/evil", client_for(evil)))


def test_geocode_rejects_other_links_and_unknown_places():
    with pytest.raises(PlaceError) as rejected:
        asyncio.run(geocode("https://example.com/map", client_for(lambda r: httpx.Response(500))))
    assert rejected.value.status == 422

    with pytest.raises(PlaceError) as missing:
        asyncio.run(geocode("asdkjhasd", client_for(lambda r: httpx.Response(200, json=[]))))
    assert missing.value.status == 404


def test_nearby_lists_named_shops_brand_matches_first():
    places._cache.clear()
    results = [
        {"name": "Tienda Cerca", "category": "shop", "type": "clothes", "lat": "-34.6000", "lon": "-58.3800"},
        {"name": "Zara", "category": "shop", "type": "clothes", "lat": "-34.6040", "lon": "-58.3800",
         "address": {"road": "Florida", "house_number": "651"}},
        {"name": "", "category": "shop", "type": "clothes", "lat": "-34.6001", "lon": "-58.3801"},  # unnamed
        {"name": "Hotel Boutique", "category": "tourism", "type": "hotel", "lat": "-34.6", "lon": "-58.38"},
        {"name": "Lejos", "category": "shop", "type": "clothes", "lat": "-34.6130", "lon": "-58.3930"},  # box corner
    ]

    def handler(request):
        assert request.url.host == "nominatim.openstreetmap.org"
        assert request.url.params["q"] == "clothes shop" and request.url.params["bounded"] == "1"
        return httpx.Response(200, json=results)

    shops = asyncio.run(nearby(-34.6, -58.38, 1500, ["ZARA Argentina", "Mercado Libre"], client_for(handler)))
    assert [shop.name for shop in shops] == ["Zara", "Tienda Cerca"]
    assert shops[0].brand_match and not shops[1].brand_match
    assert shops[0].address == "Florida 651"
    assert 400 < shops[0].distance_m < 500

    # Cached: the same area does not hit the service again.
    asyncio.run(nearby(-34.6, -58.38, 1500, [], client_for(lambda r: httpx.Response(500))))


def test_places_routes(make_client):
    with make_client() as client:
        located = client.get("/v1/places/geocode", params={"q": "-34.6, -58.38"})
        assert located.json() == {"lat": -34.6, "lng": -58.38, "label": "Ubicación elegida"}
        assert client.get("/v1/places/nearby", params={"lat": 120, "lng": 0}).status_code == 422
        assert client.get("/v1/places/geocode", params={"q": "x"}).status_code == 422
