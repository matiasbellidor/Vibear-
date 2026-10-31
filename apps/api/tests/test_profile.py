from app.main import CLOSET_COOKIE

PROFILE = {
    "user": "0f8fad5b-d9cb-469f-a165-70867728950e",
    "status": "done",
    "style": {"dress": "mujer", "aesthetics": ["clean-girl", "old-money"], "lifestyle": ["oficina"], "goals": [], "budget": "medio"},
    "color": {"season": "otono-suave", "undertone": "calido", "contrast": "bajo", "chroma": "suave"},
    "updated_at": 10,
}


def test_a_new_browser_has_a_new_profile_and_no_cookie(make_client):
    with make_client() as client:
        response = client.get("/v1/profile")
        assert response.json()["status"] == "new" and response.json()["color"] is None
        assert CLOSET_COOKIE not in response.cookies


def test_the_profile_comes_back_and_shares_the_closets_anonymous_cookie(make_client):
    with make_client() as client:
        client.put("/v1/closet", json={"items": [], "updated_at": 1})
        cookie = client.cookies[CLOSET_COOKIE]
        assert client.put("/v1/profile", json=PROFILE).status_code == 200
        assert client.cookies[CLOSET_COOKIE] == cookie  # one anonymous user, not two
        back = client.get("/v1/profile").json()
        assert back["user"] == PROFILE["user"] and back["color"]["season"] == "otono-suave"
        assert back["style"]["aesthetics"] == ["clean-girl", "old-money"]
    with make_client() as other:
        assert other.get("/v1/profile").json()["status"] == "new"


def test_an_older_copy_cannot_overwrite_a_newer_profile(make_client):
    with make_client() as client:
        client.put("/v1/profile", json=PROFILE | {"updated_at": 20})
        stale = client.put("/v1/profile", json=PROFILE | {"status": "skipped", "updated_at": 5})
        assert stale.json()["status"] == "done"


def test_profiles_only_take_short_keys(make_client):
    with make_client() as client:
        bad_key = PROFILE | {"style": {"aesthetics": ["<script>"]}}
        assert client.put("/v1/profile", json=bad_key).status_code == 422
        too_many = PROFILE | {"style": {"aesthetics": [f"k{i}" for i in range(20)]}}
        assert client.put("/v1/profile", json=too_many).status_code == 422
        assert client.put("/v1/profile", json=PROFILE | {"user": "not-a-uuid"}).status_code == 422
