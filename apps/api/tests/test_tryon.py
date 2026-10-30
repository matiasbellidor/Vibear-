import base64
import io

from conftest import BLUE, RED, FakePose, png_bytes
from PIL import Image, ImageDraw

from app.ml.detector import Detection
from app.tryon import cut_white


def outfit_photo() -> bytes:
    """A 'person': a red top over blue trousers on grey."""
    image = Image.new("RGB", (300, 450), (128, 128, 128))
    draw = ImageDraw.Draw(image)
    draw.rectangle((100, 100, 200, 230), fill=RED)
    draw.rectangle((110, 230, 190, 420), fill=BLUE)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


TOP = Detection("short_sleeved_shirt", 0.9, (100, 100, 200, 230), ((100, 100), (200, 100), (200, 230), (100, 230)))
TROUSERS = Detection("trousers", 0.8, (110, 230, 190, 420), ((110, 230), (190, 230), (190, 420), (110, 420)))


def decoded(data_url: str) -> Image.Image:
    assert data_url.startswith("data:image/webp;base64,")
    return Image.open(io.BytesIO(base64.b64decode(data_url.split(",", 1)[1])))


def test_a_full_body_photo_gives_its_keypoints(make_client):
    with make_client() as client:
        body = client.post("/v1/tryon/body", files={"file": ("me.png", outfit_photo(), "image/png")}).json()
    assert (body["width"], body["height"]) == (300, 450)
    assert body["keypoints"]["left_shoulder"] == [0.62, 0.25]
    assert body["keypoints"]["right_ankle"] == [0.44, 0.95]


def test_a_photo_without_a_full_body_is_refused(make_client):
    half = {"nose": (0.5, 0.2), "left_shoulder": (0.6, 0.6), "right_shoulder": (0.4, 0.6)}  # cut at the chest
    with make_client(pose=FakePose(half)) as client:
        response = client.post("/v1/tryon/body", files={"file": ("me.png", outfit_photo(), "image/png")})
    assert response.status_code == 422


def test_a_full_outfit_gives_every_garment_cut_out_with_its_wearer(make_client):
    with make_client(detections=[TROUSERS, TOP]) as client:
        result = client.post("/v1/tryon/garments", files={"file": ("look.png", outfit_photo(), "image/png")}).json()
    assert [(item["slot"], item["label"]) for item in result["items"]] == [("top", "short_sleeved_shirt"), ("bottom", "trousers")]
    top = result["items"][0]
    assert top["box"] == [100 / 300, 100 / 450, 201 / 300, 231 / 450]
    piece = decoded(top["image"])
    assert piece.mode == "RGBA" and piece.size == (101, 131)
    assert piece.getpixel((50, 60))[:3] == RED or abs(piece.getpixel((50, 60))[0] - RED[0]) < 6
    assert result["pose"]["left_hip"] == [0.58, 0.52]  # the wearer anchors the fit


def test_what_a_top_covers_is_cut_out_of_the_trousers():
    from app.tryon import cut_garment

    image = Image.open(io.BytesIO(outfit_photo())).convert("RGB")
    long_trousers = Detection("trousers", 0.8, (110, 200, 190, 420), ((110, 200), (190, 200), (190, 420), (110, 420)))
    piece, _ = cut_garment(image, long_trousers, [TOP])
    assert piece.getpixel((40, 5))[3] == 0  # the top's hem, inside the trousers' mask, is gone
    assert piece.getpixel((40, 120))[3] == 255


def test_a_product_shot_on_white_is_cut_from_its_background(make_client):
    shot = Image.new("RGB", (200, 260), "white")
    ImageDraw.Draw(shot).rectangle((50, 40, 150, 220), fill=(20, 20, 60))
    buffer = io.BytesIO()
    shot.save(buffer, "PNG")
    with make_client(detections=[], pose=FakePose(None)) as client:
        result = client.post("/v1/tryon/garments", files={"file": ("p.png", buffer.getvalue(), "image/png")}).json()
    [item] = result["items"]
    assert (item["slot"], item["label"], result["pose"]) == ("top", None, None)
    piece = decoded(item["image"])
    assert abs(piece.width - 101) <= 3 and abs(piece.height - 181) <= 3  # trimmed to the garment
    assert piece.getpixel((2, 2))[3] < 40 or piece.getpixel((50, 90))[3] == 255


def test_cut_white_leaves_photos_that_are_not_studio_shots_alone():
    assert cut_white(Image.new("RGB", (100, 100), (90, 120, 80))) is None


def test_a_photo_with_no_garment_is_refused(make_client):
    with make_client(detections=[]) as client:
        response = client.post("/v1/tryon/garments", files={"file": ("x.png", png_bytes((90, 120, 80)), "image/png")})
    assert response.status_code == 422
