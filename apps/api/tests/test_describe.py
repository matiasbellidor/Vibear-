import numpy as np
import pytest
from conftest import RED, png_bytes
from PIL import Image

from app.ml.describe import Description, GarmentDescriber, brand_from_titles, color_name, color_phrase, garment_colors
from app.ml.detector import Detection


def lab(L, chroma, hue):
    return np.array([L, chroma * np.cos(np.radians(hue)), chroma * np.sin(np.radians(hue))])


# Lab of real garments' masked pixels (see color_name): shade changes lightness, not the name.
@pytest.mark.parametrize(
    ("L", "chroma", "hue", "expected"),
    [
        (70, 6, 96, "crema"),  # cream wide trousers in shade
        (17, 0, 302, "negro"),  # black sherpa sweater
        (35, 15, 268, "azul"),  # raw denim jacket
        (46, 13, 82, "caqui"),  # khaki chinos
        (28, 6, 25, "marrón"),  # brown leather jacket
        (24, 8, 240, "azul marino"),  # dark jeans
        (78, 5, 295, "blanco"),  # white trousers
        (34, 0, 297, "gris oscuro"),
        (50, 3, 174, "gris"),
        (45, 60, 35, "rojo"),
        (30, 30, 10, "bordó"),
    ],
)
def test_colours_are_named_by_hue_first(L, chroma, hue, expected):
    assert color_name(lab(L, chroma, hue)) == expected


def test_colour_words_agree_with_the_garment():
    assert color_phrase([("negro", 1.0)], "f") == "negra"
    assert color_phrase([("blanco", 0.54), ("azul marino", 0.46)], "f") == "blanca y azul marino"
    assert color_phrase([("gris", 1.0)], "f") == "gris"


def test_a_two_tone_garment_gets_both_colours_but_trousers_never_do():
    stripes = Image.new("RGB", (200, 200))
    for y in range(0, 200, 40):  # navy and cream bands
        stripes.paste((25, 35, 70), (0, y, 200, y + 20))
        stripes.paste((238, 230, 210), (0, y + 20, 200, y + 40))
    box = (0, 0, 200, 200)
    assert [name for name, _ in garment_colors(stripes, box)] == ["azul marino", "crema"]
    assert len(garment_colors(stripes, box, two_tone=False)) == 1


def test_colour_is_read_inside_the_mask_only():
    image = Image.new("RGB", (100, 100), (240, 240, 240))  # white background
    image.paste((20, 20, 22), (30, 30, 70, 70))  # a black garment in the middle
    square = ((30, 30), (70, 30), (70, 70), (30, 70))
    assert garment_colors(image, (0, 0, 100, 100), square) == [("negro", 1.0)]


def test_brand_comes_from_what_the_results_agree_on():
    titles = [
        "Stüssy Sherpa Polo Sweater Black",
        "STUSSY polo collar fleece",
        "Buzo Stussy corderito negro",
        "Sherpa pullover black",
        "Polo sweater oversize",
    ]
    assert brand_from_titles(titles) == ("Stüssy", 3)
    assert brand_from_titles(titles[3:]) is None  # no agreement, no brand


def test_an_unknown_brand_still_counts_when_titles_start_with_it():
    titles = ["Lumbre Buzo polo negro", "Lumbre sweater sherpa", "LUMBRE Polo corderito", "Buzo polo corderito"]
    assert brand_from_titles(titles) == ("Lumbre", 3)


def test_garment_words_are_not_mistaken_for_brands():
    assert brand_from_titles(["Buzo polo negro", "Buzo sherpa", "Buzo de corderito", "Buzo oversize"]) is None


class FakeDescriber:
    def __init__(self):
        self.seen = []

    def warm(self):
        pass

    def is_menswear(self, vector):
        return True

    def describe(self, crop, label, image, box, polygon=None, vector=None, man=False):
        self.seen.append((label, polygon, man))
        return Description(name="Buzo polo de corderito negro", kind="Buzo polo", color="negro", brand=None, similar="Stüssy")


def test_detect_returns_what_each_garment_really_is(make_client):
    detection = Detection("long_sleeved_shirt", 0.9, (20, 10, 280, 220), ((20, 10), (280, 10), (280, 220)))
    describer = FakeDescriber()
    with make_client(detections=[detection], describer=describer) as client:
        item = client.post("/v1/detect", files={"file": ("p.png", png_bytes(RED), "image/png")}).json()["items"][0]
    assert (item["label"], item["name"], item["kind"], item["brand"], item["similar"]) == (
        "long_sleeved_shirt", "Buzo polo de corderito negro", "Buzo polo", None, "Stüssy")
    # The mask reaches the describer, and so does the whole photo's menswear call.
    assert describer.seen == [("long_sleeved_shirt", ((20, 10), (280, 10), (280, 220)), True)]


class PromptEmbedder:
    """Image and text vectors where one prompt is the obvious winner, to test the type choice."""

    def __init__(self, winner):
        self.winner = winner

    def embed(self, images):
        return np.array([[1.0, 0.0, 0.0]] * len(images))

    def embed_text(self, prompts):
        return np.array([[1.0, 0.0, 0.0] if self.winner in p else [0.0, 1.0, 0.0] for p in prompts])


def test_without_a_brand_a_signature_design_is_simil_that_brand():
    tee = Image.new("RGB", (60, 60), (128, 128, 128))
    box = (0, 0, 60, 60)
    polo = GarmentDescriber(PromptEmbedder("polo shirt")).describe(tee, "short_sleeved_shirt", tee, box)
    assert (polo.kind, polo.brand, polo.similar) == ("Chomba", None, "Polo Ralph Lauren")
    jeans = GarmentDescriber(PromptEmbedder("baggy jeans")).describe(tee, "trousers", tee, box)
    assert jeans.similar == "Levi's"
    plain = GarmentDescriber(PromptEmbedder("t-shirt")).describe(tee, "short_sleeved_shirt", tee, box)
    assert plain.similar is None  # a plain tee is nobody's signature


def test_menswear_photos_never_get_womenswear_names():
    describer = GarmentDescriber(PromptEmbedder("crop top"))
    tee = Image.new("RGB", (60, 60), (128, 128, 128))
    box = (0, 0, 60, 60)
    assert describer.describe(tee, "short_sleeved_shirt", tee, box).kind == "Top corto"
    named = describer.describe(tee, "short_sleeved_shirt", tee, box, man=True)
    assert named is None or named.kind != "Top corto"
