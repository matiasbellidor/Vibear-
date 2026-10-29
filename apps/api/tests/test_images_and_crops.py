import io

import numpy as np
import pytest
from PIL import Image

from app.images import MAX_SIDE, ImageError, decode_image, encode_jpeg
from app.lens import UPLOAD_MAX_BYTES
from app.ml.detector import MAX_ITEMS, Detection, crop_detections


def test_encode_jpeg_fits_serpapi_upload_limit():
    noise = Image.fromarray(np.random.default_rng(0).integers(0, 255, (1600, 1600, 3), dtype=np.uint8))
    assert len(encode_jpeg(noise)) > UPLOAD_MAX_BYTES  # the case that needs shrinking
    assert len(encode_jpeg(noise, UPLOAD_MAX_BYTES)) <= UPLOAD_MAX_BYTES


def test_decode_downscales_and_rejects_garbage():
    buffer = io.BytesIO()
    Image.new("RGB", (4000, 2000)).save(buffer, "PNG")
    assert max(decode_image(buffer.getvalue()).size) == MAX_SIDE
    with pytest.raises(ImageError):
        decode_image(b"<html>")


def test_crops_are_padded_clamped_sorted_and_filtered():
    image = Image.new("RGB", (100, 200))
    detections = [
        Detection("skirt", 0.5, (10, 100, 90, 200)),
        Detection("vest", 0.9, (0, 0, 50, 50)),
        Detection("tiny", 0.99, (0, 0, 5, 5)),  # under 1% of the image: dropped
    ]
    crops = crop_detections(image, detections)

    assert [det.label for det, _ in crops] == ["vest", "skirt"]
    vest, skirt = crops[0][0], crops[1][0]
    assert vest.box == (0, 0, 54, 54)  # padded 8% and clamped at the top-left corner
    assert skirt.box == (4, 92, 96, 200)  # clamped at the bottom edge
    assert crops[0][1].size == (54, 54)


def test_crops_are_capped():
    image = Image.new("RGB", (100, 100))
    many = [Detection(f"item{i}", 0.5, (0, 0, 50, 50)) for i in range(MAX_ITEMS + 3)]
    assert len(crop_detections(image, many)) == MAX_ITEMS
