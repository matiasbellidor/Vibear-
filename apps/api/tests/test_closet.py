from app.main import CLOSET_COOKIE


def product(name: str, saved_at: int = 1) -> dict:
    return {
        "title": name,
        "link": f"https://shop.test/{name}",
        "source": "Shop",
        "thumbnail": f"https://img.test/{name}.png",
        "thumbnail_width": 300,
        "thumbnail_height": 400,
        "price": None,
        "similarity": 0.9,
        "savedAt": saved_at,
    }


def test_a_new_browser_has_an_empty_closet_and_no_cookie(make_client):
    with make_client() as client:
        response = client.get("/v1/closet")
        assert response.json() == {"items": [], "updated_at": 0}
        assert CLOSET_COOKIE not in response.cookies


def test_saving_issues_an_anonymous_httponly_cookie_and_the_closet_comes_back(make_client):
    with make_client() as client:
        response = client.put("/v1/closet", json={"items": [product("abrigo")], "updated_at": 10})
        assert response.status_code == 200
        header = response.headers["set-cookie"]
        assert f"{CLOSET_COOKIE}=" in header
        assert "HttpOnly" in header and "SameSite=lax" in header and "Max-Age=34560000" in header

        # Same browser (the client keeps the cookie): the closet is there, and the cookie is renewed.
        again = client.get("/v1/closet")
        assert [item["title"] for item in again.json()["items"]] == ["abrigo"]
        assert CLOSET_COOKIE in again.headers["set-cookie"]

    # Another browser, without the cookie, sees nothing.
    with make_client() as other:
        assert other.get("/v1/closet").json()["items"] == []


def test_the_newest_copy_wins(make_client):
    with make_client() as client:
        client.put("/v1/closet", json={"items": [product("nuevo")], "updated_at": 20})
        stale = client.put("/v1/closet", json={"items": [product("viejo")], "updated_at": 5})
        assert [item["title"] for item in stale.json()["items"]] == ["nuevo"]
        emptied = client.put("/v1/closet", json={"items": [], "updated_at": 30})
        assert emptied.json() == {"items": [], "updated_at": 30}


def test_the_closet_survives_an_api_restart(make_client):
    with make_client() as client:
        client.put("/v1/closet", json={"items": [product("pantalon")], "updated_at": 1})
        cookie = client.cookies[CLOSET_COOKIE]
    with make_client() as restarted:  # same data dir, fresh process state
        restarted.cookies.set(CLOSET_COOKIE, cookie)
        assert [item["title"] for item in restarted.get("/v1/closet").json()["items"]] == ["pantalon"]


def test_forged_cookies_and_oversized_closets_are_rejected(make_client):
    with make_client() as client:
        client.cookies.set(CLOSET_COOKIE, "../../etc/passwd")
        assert client.get("/v1/closet").json()["items"] == []
        # A bad id is never used as a file name: a fresh one is issued instead.
        response = client.put("/v1/closet", json={"items": [], "updated_at": 1})
        assert response.cookies[CLOSET_COOKIE] != "../../etc/passwd"

        too_many = client.put("/v1/closet", json={"items": [product(f"p{i}") for i in range(501)], "updated_at": 2})
        assert too_many.status_code == 422


def test_closet_items_must_look_like_saved_products(make_client):
    with make_client() as client:
        assert client.put("/v1/closet", json={"items": [{"title": "x"}], "updated_at": 1}).status_code == 422
