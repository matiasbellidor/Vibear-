import numpy as np
from PIL import Image

from app.ml.accessories import FashionDetector, merge
from app.ml.describe import GarmentDescriber, color_phrase, family_of
from app.ml.detector import Detection, crop_detections


def test_a_pair_of_shoes_is_one_thing_and_duplicates_go():
    found = [
        Detection("shoes", 0.96, (66, 621, 132, 799)),  # left boot
        Detection("shoes", 0.92, (147, 610, 200, 801)),  # right boot
        Detection("shoes", 0.87, (66, 617, 133, 800)),  # the left one again
        Detection("shoes", 0.48, (93, 761, 129, 799)),  # the toe of the left one
        Detection("belt", 0.74, (213, 144, 406, 253)),
        Detection("belt", 0.63, (261, 160, 390, 187)),  # inside the first belt box
    ]
    merged = merge(found)
    assert sorted((d.label, d.box) for d in merged) == [("belt", (213, 144, 406, 253)), ("shoes", (66, 610, 200, 801))]


def test_shoes_far_apart_stay_two():
    # Two shoes in a flat lay, one at the top and one at the bottom: not a pair.
    merged = merge([Detection("shoes", 0.9, (10, 10, 60, 40)), Detection("shoes", 0.8, (10, 300, 60, 330))])
    assert len(merged) == 2


class Fixed:
    def __init__(self, detections):
        self.detections = detections

    def detect(self, image):
        return self.detections


def test_the_scanner_sees_clothes_and_accessories_and_keeps_small_ones():
    image = Image.new("RGB", (400, 800), "white")
    shirt = Detection("long_sleeved_shirt", 0.9, (100, 100, 300, 400))
    shoes = Detection("shoes", 0.6, (150, 740, 250, 780))  # 1.25% of the photo: small, still kept
    found = crop_detections(image, FashionDetector(Fixed([shirt]), Fixed([shoes])).detect(image))
    assert [det.label for det, _ in found] == ["long_sleeved_shirt", "shoes"]
    assert family_of("shoes") == "shoes" and family_of("bag") == "bag" and family_of("glasses") == "accessory"


def test_plural_names_get_plural_colours():
    assert color_phrase([("negro", 1.0)], "mp") == "negros"
    assert color_phrase([("blanco", 0.6), ("gris", 0.4)], "fp") == "blancas y grises"
    assert color_phrase([("crema", 1.0)], "fp") == "crema"


class PromptEmbedder:
    def __init__(self, winner):
        self.winner = winner

    def embed(self, images):
        return np.array([[1.0, 0.0, 0.0]] * len(images))

    def embed_text(self, prompts):
        return np.array([[1.0, 0.0, 0.0] if self.winner and self.winner in p else [0.0, 1.0, 0.0] for p in prompts])


def test_shoes_are_named_and_unsure_ones_still_get_their_colour():
    black = Image.new("RGB", (80, 40), (15, 15, 18))
    box = (0, 0, 80, 40)
    loafers = GarmentDescriber(PromptEmbedder("loafers")).describe(black, "shoes", black, box)
    assert (loafers.kind, loafers.name) == ("Mocasines", "Mocasines negros")
    unsure = GarmentDescriber(PromptEmbedder(None)).describe(black, "shoes", black, box)  # every type as likely
    assert (unsure.kind, unsure.name) == ("Zapatos", "Zapatos negros")
