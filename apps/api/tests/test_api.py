from conftest import BLUE, GRAY, LENS_MATCHES, RED, FakeLens, png_bytes

from app.ml.detector import Detection

TOP_AND_BOTTOM = [
    Detection("long_sleeved_shirt", 0.91, (20, 10, 280, 220)),
    Detection("trousers", 0.84, (40, 230, 260, 440)),
]


def upload(client, data, **fields):
    return client.post("/v1/detect", files={"file": ("photo.png", data, "image/png")}, data=fields)


def test_health_reports_search_mode(make_client):
    with make_client() as client:
        assert client.get("/health").json() == {"status": "ok", "search": "off"}
    with make_client(demo_search=True) as client:
        assert client.get("/health").json()["search"] == "demo"
    with make_client(lens=FakeLens([])) as client:
        assert client.get("/health").json()["search"] == "serpapi"


def test_detect_returns_one_servable_crop_per_garment(make_client):
    with make_client(detections=TOP_AND_BOTTOM) as client:
        response = upload(client, png_bytes(RED))
        assert response.status_code == 200
        body = response.json()
        assert (body["width"], body["height"]) == (300, 450)
        assert [item["label"] for item in body["items"]] == ["long_sleeved_shirt", "trousers"]

        crop_url = body["items"][0]["crop_url"]
        assert crop_url.startswith("/media/")  # relative: the web app proxies /api/media to the API
        crop = client.get(crop_url)
        assert crop.status_code == 200
        assert crop.headers["content-type"] == "image/jpeg"


def test_look_can_be_reloaded_by_id(make_client):
    with make_client(detections=TOP_AND_BOTTOM) as client:
        detected = upload(client, png_bytes(RED)).json()
        assert client.get(f"/v1/looks/{detected['image_id']}").json() == detected
        assert client.get(f"/v1/looks/{'0' * 16}").status_code == 404
        assert client.get("/v1/looks/not-an-id").status_code == 422


def test_detect_falls_back_to_full_image(make_client):
    with make_client(detections=[]) as client:
        items = upload(client, png_bytes(RED)).json()["items"]
        assert len(items) == 1
        assert items[0]["label"] == "full_image"
        assert items[0]["confidence"] is None
        assert items[0]["box"] == [0, 0, 300, 450]


def test_detect_needs_exactly_one_input(make_client):
    with make_client() as client:
        assert client.post("/v1/detect").status_code == 400
        both = upload(client, png_bytes(RED), image_url="https://img.test/red.png")
        assert both.status_code == 400


def test_detect_rejects_non_images_and_private_urls(make_client):
    with make_client() as client:
        assert upload(client, b"not an image").status_code == 422
        private = client.post("/v1/detect", data={"image_url": "http://127.0.0.1/admin.png"})
        assert private.status_code == 422
        assert "private" in private.json()["detail"]


def test_search_ranks_by_similarity_and_caches(make_client):
    lens = FakeLens(LENS_MATCHES)
    with make_client(detections=[], lens=lens) as client:
        crop_id = upload(client, png_bytes(RED)).json()["items"][0]["crop_id"]

        first = client.post("/v1/search", json={"crop_id": crop_id}).json()
        assert first["cached"] is False
        assert [r["title"] for r in first["results"]] == ["red", "gray", "blue", "broken"]
        assert first["results"][0]["similarity"] > 0.99
        assert (first["results"][0]["thumbnail_width"], first["results"][0]["thumbnail_height"]) == (300, 450)
        broken = first["results"][-1]  # thumbnail 404 -> kept, unscored, last
        assert broken["similarity"] is None and broken["thumbnail_width"] is None

        second = client.post("/v1/search", json={"crop_id": crop_id, "limit": 2}).json()
        assert second["cached"] is True
        assert [r["title"] for r in second["results"]] == ["red", "gray"]
        assert lens.calls == 1  # the cache saved a SerpApi search


def test_demo_search_uses_local_images_and_never_caches(make_client):
    with make_client(detections=[], demo_search=True) as client:
        red = upload(client, png_bytes(RED)).json()["items"][0]["crop_id"]
        upload(client, png_bytes(BLUE))
        upload(client, png_bytes((190, 40, 35)))  # another red photo: should rank first

        results = client.post("/v1/search", json={"crop_id": red}).json()
        assert results["cached"] is False
        assert len(results["results"]) == 2  # the query image itself is excluded
        assert all(r["source"] == "Vibear demo" for r in results["results"])
        assert results["results"][0]["similarity"] > results["results"][1]["similarity"]
        assert client.get(results["results"][0]["thumbnail"]).status_code == 200

        assert client.post("/v1/search", json={"crop_id": red}).json()["cached"] is False


def test_search_errors(make_client):
    with make_client(detections=[]) as client:
        assert client.post("/v1/search", json={"crop_id": "../../etc/passwd"}).status_code == 422
        assert client.post("/v1/search", json={"crop_id": "0" * 16}).status_code == 404

        crop_id = upload(client, png_bytes(GRAY)).json()["items"][0]["crop_id"]
        disabled = client.post("/v1/search", json={"crop_id": crop_id})
        assert disabled.status_code == 503


def test_same_photo_gets_same_crop_id(make_client):
    with make_client(detections=[]) as client:
        first = upload(client, png_bytes(BLUE)).json()["items"][0]["crop_id"]
        second = upload(client, png_bytes(BLUE)).json()["items"][0]["crop_id"]
        assert first == second
