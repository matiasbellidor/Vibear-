"""Name a detected garment the way a person would: "Buzo polo de corderito negro", "Jean ancho celeste".

YOLO (DeepFashion2) only knows 13 coarse classes ("long sleeved shirt"), so the name is built from:
- the type, by FashionCLIP zero-shot over a Spanish catalogue of garments (prompts in English, which
  is what the model was trained on);
- the material, also zero-shot, kept only when the model is clearly sure;
- the colour, measured on the garment's own pixels (YOLO's segmentation mask), because CLIP is
  poor at colour (it called a black sweater grey);
- a brand hint, zero-shot, only when it is very sure. Brands mostly come from the search results
  (brand_from_titles), which is far more reliable.
"""

from collections import Counter
from dataclasses import dataclass
import re
import unicodedata

import numpy as np
from PIL import Image, ImageDraw

# English prompt -> (Spanish name, grammatical gender, material it already names)
UPPER = {
    "t-shirt": ("Remera", "f", None),
    "long sleeve t-shirt": ("Remera manga larga", "f", None),
    "polo shirt": ("Chomba", "f", None),
    "long sleeve polo shirt": ("Chomba manga larga", "f", None),
    "button-up shirt": ("Camisa", "f", None),
    "denim shirt": ("Camisa de jean", "f", "denim"),
    "flannel shirt": ("Camisa a cuadros", "f", None),
    "rugby shirt": ("Camiseta rugby", "f", None),
    "football jersey": ("Camiseta de fútbol", "f", None),
    "tank top": ("Musculosa", "f", None),
    "crop top": ("Top corto", "m", None),
    "sports bra": ("Top deportivo", "m", None),
    "crewneck sweatshirt": ("Buzo", "m", None),
    "hoodie": ("Buzo con capucha", "m", None),
    "polo collar sweater": ("Buzo polo", "m", None),
    "fleece pullover": ("Buzo polar", "m", "fleece"),
    "sherpa pullover": ("Buzo de corderito", "m", "sherpa"),
    "knit sweater": ("Sweater tejido", "m", "knit"),
    "turtleneck sweater": ("Polera", "f", None),
    "cardigan": ("Cárdigan", "m", None),
    "knit vest": ("Chaleco tejido", "m", "knit"),
    "puffer vest": ("Chaleco inflable", "m", None),
    "denim vest": ("Chaleco de jean", "m", "denim"),
    "zip-up jacket": ("Campera con cierre", "f", None),
    "denim jacket": ("Campera de jean", "f", "denim"),
    "leather jacket": ("Campera de cuero", "f", "leather"),
    "puffer jacket": ("Campera inflable", "f", None),
    "bomber jacket": ("Campera bomber", "f", None),
    "varsity jacket": ("Campera varsity", "f", None),
    "windbreaker": ("Rompevientos", "m", None),
    "wool coat": ("Tapado", "m", "wool"),
    "trench coat": ("Trench", "m", None),
    "blazer": ("Blazer", "m", None),
}
PANTS = {
    "jeans": ("Jean", "m", "denim"),
    "baggy jeans": ("Jean ancho", "m", "denim"),
    "cargo pants": ("Pantalón cargo", "m", None),
    "sweatpants": ("Jogging", "m", None),
    "tailored trousers": ("Pantalón de vestir", "m", None),
    "chino pants": ("Pantalón chino", "m", None),
    "wide leg trousers": ("Pantalón ancho", "m", None),
    "linen pants": ("Pantalón de lino", "m", "linen"),
    "leggings": ("Calza", "f", None),
}
SHORTS = {
    "denim shorts": ("Short de jean", "m", "denim"),
    "bermuda shorts": ("Bermuda", "f", None),
    "athletic shorts": ("Short deportivo", "m", None),
    "biker shorts": ("Calza corta", "f", None),
}
SKIRTS = {
    "pleated tennis skirt": ("Pollera tenis", "f", None),
    "mini skirt": ("Minifalda", "f", None),
    "midi skirt": ("Pollera midi", "f", None),
    "maxi skirt": ("Pollera larga", "f", None),
    "denim skirt": ("Pollera de jean", "f", "denim"),
}
DRESSES = {
    "mini dress": ("Vestido corto", "m", None),
    "maxi dress": ("Vestido largo", "m", None),
    "slip dress": ("Vestido lencero", "m", None),
    "shirt dress": ("Vestido camisero", "m", None),
    "knit dress": ("Vestido tejido", "m", "knit"),
}
FAMILY = {
    "trousers": PANTS,
    "shorts": SHORTS,
    "skirt": SKIRTS,
    **{label: DRESSES for label in ("short_sleeved_dress", "long_sleeved_dress", "vest_dress", "sling_dress")},
}
# Shirts and outerwear share one catalogue: YOLO often calls a sweater a shirt or a shirt a jacket.

# English prompt -> Spanish suffix. Cotton and "plain" say nothing, so they never make it to the name.
MATERIALS = {
    "plain": None,
    "cotton": None,
    "denim": "de jean",
    "leather": "de cuero",
    "sherpa": "de corderito",
    "fleece": "polar",
    "knit": ("tejido", "tejida"),
    "corduroy": "de corderoy",
    "linen": "de lino",
    "wool": "de lana",
    "satin": "de satén",
    "nylon": "de nylon",
}

# Which materials a type can plausibly be, so the zero-shot pick stays sensible (it once called a
# plain grey tee "de cuero"). Types not listed here take no material at all.
_KNITWEAR = {"knit", "sherpa", "fleece", "wool"}
_OUTERWEAR = {"leather", "corduroy", "wool", "nylon", "sherpa", "fleece", "denim"}
_LOWER = {"linen", "corduroy", "wool", "leather", "satin"}
_DRESSY = {"satin", "linen", "knit", "leather", "denim"}
MATERIALS_FOR = {
    **{t: _KNITWEAR for t in ("crewneck sweatshirt", "hoodie", "polo collar sweater", "turtleneck sweater", "cardigan")},
    **{t: {"linen", "corduroy", "satin"} for t in ("button-up shirt", "flannel shirt")},
    **{t: _OUTERWEAR for t in ("zip-up jacket", "puffer jacket", "bomber jacket", "varsity jacket", "windbreaker",
                               "trench coat", "blazer", "puffer vest")},
    **{t: _LOWER for t in ("cargo pants", "tailored trousers", "chino pants", "wide leg trousers", "bermuda shorts")},
    **{t: _DRESSY for c in (SKIRTS, DRESSES) for t in c},
}

# Colour words that change with gender; the rest (gris, crema, azul marino...) don't.
FEMININE = {"negro": "negra", "blanco": "blanca", "rojo": "roja", "amarillo": "amarilla"}

BRANDS = {
    "Polo Ralph Lauren": "Ralph Lauren", "Ralph Lauren": "Ralph Lauren", "Lacoste": "Lacoste", "Tommy Hilfiger": "Tommy Hilfiger",
    "Nike": "Nike", "Adidas": "Adidas", "Stussy": "Stüssy", "Carhartt": "Carhartt", "Supreme": "Supreme",
    "The North Face": "The North Face", "Levi's": "Levi's", "Champion": "Champion", "Patagonia": "Patagonia",
    "New Balance": "New Balance", "Dickies": "Dickies", "Lululemon": "Lululemon", "Alo Yoga": "Alo Yoga",
    "Burberry": "Burberry", "Gucci": "Gucci", "Prada": "Prada", "Converse": "Converse", "Vans": "Vans",
}
BRAND_MIN_SHARE = 0.7  # zero-shot brands are a hint only when the model is this sure

# Known brands for reading search results (matched as whole words, accents ignored), Argentine ones included.
KNOWN_BRANDS = sorted({
    *BRANDS.values(), "Zara", "H&M", "Uniqlo", "Mango", "Pull&Bear", "Bershka", "Stradivarius", "Massimo Dutti", "COS",
    "Arket", "Shein", "Gap", "Abercrombie & Fitch", "Hollister", "American Eagle", "Calvin Klein", "Diesel", "Guess",
    "Puma", "Reebok", "Under Armour", "Asics", "Fila", "Kappa", "Umbro", "Columbia", "Arc'teryx", "Salomon",
    "Stone Island", "C.P. Company", "Palace", "Kith", "Bape", "Off-White", "Fear of God", "Acne Studios",
    "Balenciaga", "Louis Vuitton", "Dior", "Saint Laurent", "Celine", "Loewe", "Miu Miu", "Fendi", "Versace",
    "Moncler", "Canada Goose", "Barbour", "Fred Perry", "Ben Sherman", "Wrangler", "Dr. Martens", "Timberland",
    "Birkenstock", "Crocs", "Skechers", "Hoka", "On Running", "Gymshark", "Sporty & Rich", "Aimé Leon Dore",
    "Brandy Melville", "Urban Outfitters", "Free People", "Reformation", "Aritzia", "Wilson",
    # Brands that are also everyday words ("Ver", "Lee", "Head") are left out: they'd match any title.
    "Rapsodia", "Kosiuko", "Wanama", "Bensimon", "Akiabara", "Prüne", "Complot", "Vitamina", "Mishka",
    "Kevingston", "Taverniti", "Cardón", "Ona Saez", "Ayres", "Rever Pass", "Jazmín Chebar", "Paula Cahen D'Anvers",
    "Etiqueta Negra", "Penguin", "Grimoldi", "Topper", "47 Street", "Sweet Victorian", "Muaa", "Tascani",
})
# First words of a title that are not brands (garments, audiences, shop words), for unknown brands.
NOT_BRANDS = {
    "buzo", "buzos", "remera", "remeras", "camisa", "camiseta", "sweater", "sueter", "sweatshirt", "hoodie", "polo",
    "chomba", "campera", "jacket", "jean", "jeans", "pantalon", "pants", "trousers", "short", "shorts", "pollera",
    "falda", "skirt", "vestido", "dress", "top", "musculosa", "tapado", "coat", "zapatillas", "sneakers", "new",
    "nuevo", "nueva", "men", "mens", "men's", "women", "womens", "women's", "hombre", "mujer", "unisex", "vintage",
    "oversize", "oversized", "the", "el", "la", "los", "las", "un", "una", "de", "con", "for", "set", "conjunto",
    "sale", "oferta", "black", "white", "negro", "negra", "blanco", "blanca", "chaleco", "cardigan", "sudadera",
    "playera", "blusa", "blouse", "shirt", "tee", "t-shirt", "kids", "nino", "nina", "bebe", "promo", "original",
}


# Broad families of what a shop picture can show. A result is dropped when it clearly belongs to a
# family other than the scanned garment's (Lens likes to add shoes, bags and other parts of the look).
FAMILY_PROMPTS = {
    "top": ["a t-shirt", "a shirt", "a sweater", "a hoodie", "a jacket", "a coat", "a tank top"],
    "bottom": ["a pair of pants", "a pair of jeans", "a pair of shorts", "a skirt"],
    "dress": ["a dress"],
    "shoes": ["a pair of shoes", "a pair of sneakers", "a pair of boots"],
    "bag": ["a bag", "a backpack"],
    "accessory": ["a hat", "a cap", "a pair of sunglasses", "a watch", "a belt", "a necklace", "a scarf", "a perfume bottle"],
}
LABEL_FAMILY = {
    **{label: "top" for label in ("short_sleeved_shirt", "long_sleeved_shirt", "short_sleeved_outwear",
                                  "long_sleeved_outwear", "vest", "sling")},
    **{label: "bottom" for label in ("trousers", "shorts", "skirt")},
    **{label: "dress" for label in ("short_sleeved_dress", "long_sleeved_dress", "vest_dress", "sling_dress")},
}
# A result is kept unless its own family's share is this low. Calibrated on the demo catalog: for a
# trousers query, the jackets and sweaters CLIP still rated 0.63-0.65 similar scored 0.00-0.12 here,
# real trousers 0.9-1.0, and a skirt 0.20 (so it goes too).
MIN_FAMILY_SHARE = 0.25


# The styles the user curates for (Weekly Outfits, the 404 moods). Key -> prompt.
STYLES = {
    "streetwear": "a streetwear outfit",
    "old-money": "an old money quiet luxury outfit",
    "clean-girl": "a clean girl minimalist outfit",
    "university": "a preppy university outfit",
    "tenis": "a tennis outfit",
    "pilates": "a pilates athleisure outfit",
    "casual": "a casual everyday outfit",
}


def family_of(label: str | None) -> str | None:
    return LABEL_FAMILY.get(label or "")


@dataclass(frozen=True)
class Description:
    name: str  # "Buzo polo de corderito negro"
    kind: str  # "Buzo polo": short enough for a chip
    color: str | None
    brand: str | None  # a hint from the image alone; the search may find a better one


# Types never offered for a photo known to be menswear (CLIP called a man's fitted tee a crop top).
WOMENSWEAR = {"crop top", "sports bra", "leggings", "biker shorts", "mini skirt", "midi skirt", "maxi skirt",
              "pleated tennis skirt", "denim skirt", "slip dress", "mini dress", "maxi dress"}


def _agree(word: str | tuple[str, str], gender: str) -> str:
    """A word that changes with gender is a (masculine, feminine) pair."""
    if isinstance(word, tuple):
        return word[1] if gender == "f" else word[0]
    return word


def _family(label: str) -> dict:
    return FAMILY.get(label, UPPER)


def _plain(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def _srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def color_name(lab: np.ndarray) -> str:
    """Name a Lab colour by hue and chroma first: light and shadow change lightness, not hue.

    Thresholds were calibrated on photographed garments (Lab of their masked pixels): a cream
    trouser in shade is L70 C6 h96, a black sherpa L17 C0, raw denim L35 C15 h268, khaki chinos
    L46 C13 h82, brown leather L28 C6 h25.
    """
    L, a, b = (float(v) for v in lab)
    chroma = float(np.hypot(a, b))
    hue = float(np.degrees(np.arctan2(b, a)) % 360)
    warm = 10 <= hue < 110
    if chroma < 4 or (chroma < 7 and not warm) or (chroma < 5 and warm):
        return "negro" if L < 30 else "gris oscuro" if L < 45 else "gris" if L < 72 else "blanco"
    if warm and chroma < 16 and L >= 60:
        return "crema" if L >= 68 and chroma < 12 else "beige"
    if hue < 20 or hue >= 345:
        return "rosa" if L >= 65 else "bordó" if L < 35 else "rojo"
    if hue < 50:
        if chroma < 25:
            return "marrón" if L < 50 else "camel" if L < 68 else "beige"
        return "rojo" if hue < 35 and L < 55 else "naranja"
    if hue < 75:
        if chroma < 30:
            return "marrón" if L < 45 else "camel" if L < 65 else "beige"
        return "naranja"
    if hue < 105:
        if chroma < 25:
            return "marrón" if L < 35 else "caqui" if L < 65 else "beige"
        return "amarillo" if L >= 60 else "verde oliva"
    if hue < 135:
        return "verde oliva" if L < 55 or chroma < 25 else "verde"
    if hue < 190:
        return "verde"
    if hue < 300:
        return "azul marino" if L < 30 else "azul" if L < 58 else "celeste"
    return "lila" if L >= 65 else "violeta"


def _skin_like(lab: np.ndarray) -> bool:
    """Hands and necks fall inside a garment's mask; skin is a warm, mid-chroma, mid-light colour."""
    L, a, b = (float(v) for v in lab)
    return 35 <= L <= 85 and 8 <= np.hypot(a, b) <= 35 and 30 <= np.degrees(np.arctan2(b, a)) % 360 <= 75


def garment_colors(
    image: Image.Image, box: tuple[int, int, int, int], polygon=None, two_tone: bool = True
) -> list[tuple[str, float]]:
    """The garment's colours as (name, share), main one first; two only when it is really two-tone.

    Pixels come from YOLO's segmentation mask when there is one (the box alone mixes in background
    and other garments). One colour is the median of the mid-lightness pixels (highlights and deep
    folds dropped). When lightness is spread wide, a 2-means split looks for a second colour, kept
    only if it is clearly different (a navy and cream rugby, not a black jean's highlights).
    """
    x1, y1, x2, y2 = box
    crop = image.crop(box)
    scale = min(1.0, 200 / max(crop.size))
    small = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))))
    pixels = np.asarray(small.convert("RGB"), dtype=float).reshape(-1, 3)
    if polygon is not None and len(polygon) >= 3:
        mask = Image.new("L", small.size, 0)
        ImageDraw.Draw(mask).polygon([((x - x1) * scale, (y - y1) * scale) for x, y in polygon], fill=255)
        keep = np.asarray(mask).reshape(-1) > 0
        if keep.sum() > 50:
            pixels = pixels[keep]
    lab = _srgb_to_lab(pixels)
    low, q1, q3, high = np.percentile(lab[:, 0], [15, 25, 75, 85])
    main = color_name(np.median(lab[(lab[:, 0] >= low) & (lab[:, 0] <= high)], axis=0))

    if two_tone and q3 - q1 > 45:
        centers = np.percentile(lab, [20, 80], axis=0)
        for _ in range(12):
            assign = np.argmin(((lab[:, None, :] - centers[None]) ** 2).sum(axis=2), axis=1)
            centers = np.array([lab[assign == k].mean(axis=0) if (assign == k).any() else centers[k] for k in (0, 1)])
        shares = np.array([(assign == 0).mean(), (assign == 1).mean()])
        names = [color_name(c) for c in centers]
        distinct = np.sqrt(((centers[0] - centers[1]) ** 2).sum()) >= 45 and names[0] != names[1]
        if distinct and shares.min() >= 0.25 and not any(_skin_like(c) for c in centers):
            order = np.argsort(-shares)
            return [(names[i], float(shares[i])) for i in order]
    return [(main, 1.0)]


def color_phrase(colors: list[tuple[str, float]], gender: str) -> str | None:
    words = [FEMININE.get(name, name) if gender == "f" else name for name, _ in colors]
    return " y ".join(words[:2]) if words else None


class GarmentDescriber:
    """Zero-shot names with the FashionCLIP model the app already loads (no extra download)."""

    def __init__(self, embedder):
        self._embedder = embedder
        self._texts: dict[str, np.ndarray] = {}

    def _text(self, prompts: list[str]) -> np.ndarray:
        missing = [p for p in prompts if p not in self._texts]
        if missing:
            for prompt, vector in zip(missing, self._embedder.embed_text(missing)):
                self._texts[prompt] = vector
        return np.stack([self._texts[p] for p in prompts])

    def _probs(self, vector: np.ndarray, prompts: list[str]) -> np.ndarray:
        logits = (self._text(prompts) @ vector) * 100  # CLIP's logit scale
        e = np.exp(logits - logits.max())
        return e / e.sum()

    def family_shares(self, vector: np.ndarray) -> dict[str, float]:
        prompts = [f"a photo of {p}" for ps in FAMILY_PROMPTS.values() for p in ps]
        probs = self._probs(vector, prompts)
        shares, i = {}, 0
        for family, ps in FAMILY_PROMPTS.items():
            shares[family] = float(probs[i : i + len(ps)].sum())
            i += len(ps)
        return shares

    def style(self, vector: np.ndarray, man: bool = False) -> str:
        """The outfit's style, from a vector of the whole photo. Clean girl is only offered for women."""
        keys = [key for key in STYLES if not (man and key == "clean-girl")]
        probs = self._probs(vector, [f"a photo of {STYLES[key]}" for key in keys])
        return keys[int(np.argmax(probs))]

    def is_menswear(self, vector: np.ndarray) -> bool:
        """Whether a whole photo clearly shows menswear (then womenswear types aren't offered).
        Unsure counts as no: excluding types is the riskier mistake."""
        probs = self._probs(vector, ["a photo of a man wearing an outfit", "a photo of a woman wearing an outfit"])
        return bool(probs[0] >= 0.7)

    def belongs(self, vector: np.ndarray, family: str) -> bool:
        """Whether a shop picture can be the same kind of garment as the scanned one."""
        return self.family_shares(vector)[family] >= MIN_FAMILY_SHARE

    def warm(self) -> None:
        """Embed every type prompt once (a few seconds on CPU), so the first scan isn't slower."""
        catalogues = [UPPER, PANTS, SHORTS, SKIRTS, DRESSES]
        self._text([f"a photo of a {t}" for c in catalogues for t in c])
        self._text([f"a photo of {p}" for ps in FAMILY_PROMPTS.values() for p in ps])

    def describe(
        self, crop: Image.Image, label: str, image: Image.Image, box, polygon=None, vector=None, man: bool = False
    ) -> Description | None:
        """`man`: the photo is known to be menswear (the landing's pins), so womenswear types are left out."""
        catalogue = _family(label)
        types = [t for t in catalogue if not (man and t in WOMENSWEAR)] or list(catalogue)
        vector = vector if vector is not None else self._embedder.embed([crop])[0]
        probs = self._probs(vector, [f"a photo of a {t}" for t in types])
        best = int(np.argmax(probs))
        if probs[best] < 0.25:  # not sure what it is: keep YOLO's coarse name
            return None
        prompt = types[best]
        kind, gender, own_material = catalogue[prompt]

        name = kind
        allowed = MATERIALS_FOR.get(prompt, set())
        if own_material is None and allowed:
            materials = ["plain", *sorted(allowed)]
            m = self._probs(vector, [f"a photo of a {mat} {prompt}" for mat in materials])
            order = np.argsort(-m)
            top, second = materials[order[0]], m[order[1]]
            suffix = MATERIALS[top]
            if suffix and m[order[0]] >= 0.3 and m[order[0]] >= 1.5 * second:
                name += " " + _agree(suffix, gender)

        # Two-tone trousers are rare; a second colour there is nearly always shoes or a hand.
        two_tone = catalogue is not PANTS and catalogue is not SHORTS
        color = color_phrase(garment_colors(image, box, polygon, two_tone), gender)
        if color:
            name += " " + color

        # Only for the catalogue's brands, and only when very sure (BRAND_MIN_SHARE).
        names = list(BRANDS)
        b = self._probs(vector, [f"a photo of a {brand} {prompt}" for brand in names])
        merged: Counter[str] = Counter()
        for brand, p in zip(names, b):
            merged[BRANDS[brand]] += float(p)
        brand, share = merged.most_common(1)[0]
        return Description(name=name, kind=kind, color=color, brand=brand if share >= BRAND_MIN_SHARE else None)


def brand_from_titles(titles: list[str], minimum: int = 3, min_share: float = 0.25) -> tuple[str, int] | None:
    """The brand most search results agree on, and how many mention it; None if they don't agree.

    Known brands are found anywhere in a title. A brand we don't know still counts when several
    titles start with the same word that isn't a garment or shop word ("Akiabara Buzo...").
    """
    if not titles:
        return None
    counts: Counter[str] = Counter()
    for title in titles:
        plain = _plain(title)
        found = {b for b in KNOWN_BRANDS if re.search(rf"(?<![a-z0-9]){re.escape(_plain(b))}(?![a-z0-9])", plain)}
        if not found:
            first = re.match(r"[\w'&.-]+", title.strip())
            if first and len(first.group()) >= 3 and _plain(first.group()) not in NOT_BRANDS and not first.group().isdigit():
                found = {first.group().strip(".-").title()}
        counts.update(found)
    if not counts:
        return None
    brand, count = counts.most_common(1)[0]
    return (brand, count) if count >= minimum and count / len(titles) >= min_share else None
