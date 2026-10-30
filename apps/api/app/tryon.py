"""The fitting room (Outfits tab): where your body is, and your garments cut out of their photos, so the
browser can dress you up like a paper doll. Photos are read in memory and answered back: nothing is
stored on the server (the browser keeps them, on your device only).

Garments come out of a photo two ways:
- YOLO's segmentation masks: a person wearing them, or a flat lay; one cut-out per garment, so a full
  outfit gives a top, trousers and a jacket at once;
- the white background taken out: a product photo of one garment where YOLO sees nothing.
"""

import base64
from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from app.ml.detector import Detection

# Where each DeepFashion2 class goes on the body.
SLOTS = {
    "short_sleeved_shirt": "top", "long_sleeved_shirt": "top", "vest": "top", "sling": "top",
    "short_sleeved_outwear": "outer", "long_sleeved_outwear": "outer",
    "shorts": "bottom", "trousers": "bottom", "skirt": "bottom",
    "short_sleeved_dress": "dress", "long_sleeved_dress": "dress", "vest_dress": "dress", "sling_dress": "dress",
}
# FashionCLIP's families (app/ml/describe.py) for a product photo YOLO can't place.
FAMILY_SLOTS = {"top": "top", "bottom": "bottom", "dress": "dress"}
LAYER = {"bottom": 0, "dress": 1, "top": 2, "outer": 3}  # how garments stack on a body, bottom to top
BODY_POINTS = ("left_shoulder", "right_shoulder", "left_hip", "right_hip")  # the minimum to dress someone
MAX_GARMENTS = 4
MIN_AREA = 0.02  # of the photo: smaller "garments" are a scarf corner or a shoe
MAX_SIDE = 900  # cut-outs are shown at most this big
WHITE = 236  # a studio background: this light on every channel...
GREY = 22  # ...and this close to grey


def normalized(points: dict[str, tuple[float, float]], width: int, height: int) -> dict[str, list[float]]:
    return {name: [round(x / width, 4), round(y / height, 4)] for name, (x, y) in points.items()}


def is_full_body(points: dict[str, tuple[float, float]] | None) -> bool:
    return bool(points) and all(name in points for name in BODY_POINTS)


def cut_garment(image: Image.Image, det: Detection, over: list[Detection] = ()) -> tuple[Image.Image, tuple[int, int, int, int]] | None:
    """The garment alone (transparent around it, soft edge), trimmed to its outline, and that box.

    `over`: garments worn on top of it in the same photo. Masks overlap (the trousers' takes in the
    sweater's hem), so what they cover is taken out: on the body, they'll cover it again.
    """
    if not det.polygon or len(det.polygon) < 3:
        return None
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(x, y) for x, y in det.polygon], fill=255)
    for other in over:
        if other.polygon and len(other.polygon) >= 3:
            draw.polygon([(x, y) for x, y in other.polygon], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    xs, ys = [x for x, _ in det.polygon], [y for _, y in det.polygon]
    box = (max(0, int(min(xs))), max(0, int(min(ys))), min(image.width, int(max(xs)) + 1), min(image.height, int(max(ys)) + 1))
    if (box[2] - box[0]) * (box[3] - box[1]) < MIN_AREA * image.width * image.height:
        return None
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    return rgba.crop(box), box


def _white(image: Image.Image, slack: int = 0) -> np.ndarray:
    pixels = np.asarray(image, dtype=np.int16)
    low, high = pixels.min(axis=2), pixels.max(axis=2)
    return (low >= WHITE - slack) & (high - low <= GREY + slack)


def cut_white(image: Image.Image) -> Image.Image | None:
    """A product shot: the white touching the edges out, trimmed. None if it isn't on white.

    The flood from the edges runs on a small copy (PIL's flood fill is pixel by pixel); at full size
    a pixel is background where the small mask says so and it is white itself, so edges stay sharp.
    """
    rgb = image.convert("RGB")
    small = rgb.copy()
    small.thumbnail((320, 320))
    # A copy: an image made from an array is read-only (Pillow 13), and the flood fill would do nothing.
    mask = Image.fromarray(_white(small).astype(np.uint8) * 255).copy()
    w, h = mask.size
    for x, y in [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]:
        if mask.getpixel((x, y)) == 255:
            ImageDraw.floodfill(mask, (x, y), 128, thresh=0)
    flooded = np.asarray(mask) == 128
    if not 0.1 <= flooded.mean() <= 0.97:
        return None  # not a studio shot, or nothing on it
    reach = np.asarray(Image.fromarray(flooded.astype(np.uint8) * 255).resize(rgb.size, Image.BILINEAR)) > 127
    background = reach & _white(rgb, slack=8)
    hard = Image.fromarray(np.where(background, 0, 255).astype(np.uint8))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(hard.filter(ImageFilter.GaussianBlur(1)))
    return rgba.crop(hard.getbbox())  # trimmed to the garment itself, not its soft rim


def data_url(image: Image.Image) -> str:
    """WebP keeps the transparency at a fraction of a PNG's size."""
    image = image.copy()
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, "WEBP", quality=88, method=4)
    return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode()
