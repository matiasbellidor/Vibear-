"""Rebuild the landing photos, the scan explainer and the API's demo catalog.

From the curated, freely licensed Wikimedia Commons photos below (credits included) this writes:
- apps/web/public/landing/: pins for the carousels (outfits for women and men, products, and
  flat-lay boards composed from product cutouts), plus the explainer photo and its matches;
- apps/web/src/lib/landing.ts: sizes, credits, garment hotspots and the explainer data;
- apps/api/app/demo_catalog/: garment crops + catalog.json, the "products" of DEMO_SEARCH.

Everything model-related is real output: YOLO boxes and FashionCLIP similarities.
Run from apps/api with the API's venv (needs network and the models):
    python scripts/build_landing_assets.py

Local mode builds the landing from your own folder instead (subfolders destacada/, mujer/, hombre/, productos/)
into apps/web/public/landing-local/ (gitignored: photos you don't own the rights to never reach
GitHub). The web app prefers that manifest when it exists:
    python scripts/build_landing_assets.py --local ../web/local-photos
"""

import argparse
import json
import re
import shutil
import sys
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import SIMILARITY_FLOOR, USER_AGENT  # noqa: E402
from app.ml.describe import GarmentDescriber, family_of  # noqa: E402
from app.ml.detector import YoloGarmentDetector, crop_detections  # noqa: E402
from app.ml.embedder import ClipEmbedder  # noqa: E402

API = Path(__file__).resolve().parents[1]
WEB = API.parent / "web"
PUBLIC = WEB / "public" / "landing"
CATALOG = API / "app" / "demo_catalog"

# Curated by hand: one clear outfit per photo, no visible logos, no celebrities or named people,
# no brand names in the title. Balanced on purpose: as many menswear as womenswear photos.
WOMEN = [
    "File:Yacht Club Chic (Unsplash).jpg",
    "File:Woman in ripped jeans (Unsplash).jpg",
    "File:Brooke Cagle 2017-01-30 (Unsplash emlKHDEydhg).jpg",
    "File:Ocean Blue Outfit (Unsplash).jpg",
    "File:Woman knitwear car (Unsplash).jpg",
    "File:Rita (37).jpg",
    "File:Young woman in a cardigan at Art Fair on the Square.jpg",
    "File:Jokul (Unsplash).jpg",
    "File:Magdalena 4 (Unsplash).jpg",
    "File:Brooke Cagle 2017-01-30 (Unsplash HIEAVcz3CzU).jpg",
    "File:Serge 2017 (Unsplash).jpg",
    "File:Skinny Jeans (Unsplash).jpg",
]
MEN = [
    "File:Confidence is key (Unsplash).jpg",
    "File:Man looking at ocean (Unsplash).jpg",
    "File:Man with palm tree (Unsplash).jpg",
    "File:Men's Fall Fashion (Unsplash).jpg",
    "File:Street portrait (Unsplash).jpg",
    "File:Fashion Time, Modeling Photography in Tbilisi - Iranian Model - Jorj Barber 26.jpg",
    "File:Yellow hoodie in streetwear outfit (52774092506).jpg",
    "File:02.17.Independence.WDC.4jul05 (24120370).jpg",
    "File:Man carrying skateboard (Unsplash).jpg",
    "File:Faceless (Unsplash).jpg",
    "File:Man and cellphone (Unsplash).jpg",
    "File:Zelfgebreide trui met v-hals - Home knitted V-necked sweater (4106588198).jpg",
]
# Products shown as single pins, and the garment class each one is (shoes are not a YOLO class).
PRODUCTS = {
    "File:Puffa Jeans BW (3213392471).jpg": None,  # a flat lay already: let YOLO find both pieces
    "File:Loafer shoes for men.jpg": "shoes",
    "File:Jeans Gul&Blå i modellen Dallas.jpg": "trousers",
}
PRODUCT_CROPS = {"File:Jeans Gul&Blå i modellen Dallas.jpg": (0.0, 0.0, 1.0, 0.93)}  # drop the caption strip
# Flat-lay boards composed from white-background product shots: (title, crop box as fractions,
# slot in a 480x620 card as x, y, w, h). Items are cut out and fitted into their slot.
BOARDS = [
    [
        ("File:Coat, evening, man's (AM 1996.220.1-1).jpg", (0.0, 0.0, 1.0, 0.9), (16, 20, 250, 330), "long_sleeved_outwear"),
        ("File:Stretch Jeans from AKINGS.jpg", (0.0, 0.0, 1.0, 1.0), (270, 40, 190, 420), "trousers"),
        ("File:Loafer shoes for men.jpg", (0.0, 0.0, 1.0, 1.0), (40, 400, 220, 190), "shoes"),
    ],
    [
        ("File:Coat, evening, man's (AM 1996.220.1-5).jpg", (0.0, 0.0, 1.0, 0.88), (20, 30, 260, 340), "long_sleeved_outwear"),
        ("File:Jeans BW 2 (3213391837).jpg", (0.0, 0.0, 1.0, 1.0), (250, 210, 210, 390), "trousers"),
    ],
]
EXPLAINER = "File:Men's Fall Fashion (Unsplash).jpg"
EXPLAINER_QUERY = "outwear"  # search the jacket; compare it with other outerwear
LABEL_ES = {
    "short_sleeved_shirt": "Top manga corta", "long_sleeved_shirt": "Top manga larga",
    "short_sleeved_outwear": "Abrigo manga corta", "long_sleeved_outwear": "Abrigo manga larga",
    "vest": "Musculosa", "sling": "Top de breteles", "shorts": "Short", "trousers": "Pantalón",
    "skirt": "Pollera", "short_sleeved_dress": "Vestido manga corta", "long_sleeved_dress": "Vestido manga larga",
    "vest_dress": "Vestido sin mangas", "sling_dress": "Vestido de breteles", "shoes": "Zapatos",
}
PIN_WIDTH, DEMO_WIDTH, CROP_WIDTH, BOARD_SIZE = 400, 1080, 320, (480, 620)  # the hero photo is the first thing seen: sharp on retina
BOARD_BACKGROUND = (239, 238, 233)
MIN_CONFIDENCE = 0.5


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()


_cache: dict[str, tuple[Image.Image, dict]] = {}


def commons(title: str) -> tuple[Image.Image, dict]:
    if title in _cache:
        return _cache[title]
    params = {"action": "query", "titles": title, "prop": "imageinfo", "format": "json",
              "iiprop": "url|extmetadata", "iiurlwidth": 960}
    pages = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    info = next(iter(pages["query"]["pages"].values()))["imageinfo"][0]
    meta = info["extmetadata"]
    artist = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
    credit = {
        "title": title.removeprefix("File:").rsplit(".", 1)[0],
        "author": artist or "Unknown",
        "license": meta["LicenseShortName"]["value"],
        "url": info["descriptionurl"],
    }
    _cache[title] = (Image.open(BytesIO(fetch(info["thumburl"]))).convert("RGB"), credit)
    return _cache[title]


def save_webp(image: Image.Image, folder: Path, name: str, width: int, quality: int = 72) -> dict:
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    image.save(folder / f"{name}.webp", "WEBP", quality=quality, method=6)
    return {"width": image.width, "height": image.height}


def cutout(image: Image.Image) -> Image.Image:
    """Remove a white studio background connected to the corners (white inside the garment stays)."""
    work = image.copy()
    for corner in [(0, 0), (work.width - 1, 0), (0, work.height - 1), (work.width - 1, work.height - 1)]:
        if min(work.getpixel(corner)) > 215:
            ImageDraw.floodfill(work, corner, (255, 0, 255), thresh=34)
    background = (np.asarray(work) == [255, 0, 255]).all(axis=-1)
    alpha = Image.fromarray(np.where(background, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba.crop(alpha.point(lambda a: 255 if a > 20 else 0).getbbox())


def compose_board(items) -> tuple[Image.Image, list[dict]]:
    card = Image.new("RGB", BOARD_SIZE, BOARD_BACKGROUND)
    credits, hotspots = [], []
    for title, (l, t, r, b), (x, y, w, h), label in items:
        image, credit = commons(title)
        piece = cutout(image.crop((round(l * image.width), round(t * image.height),
                                   round(r * image.width), round(b * image.height))))
        scale = min(w / piece.width, h / piece.height)
        piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.LANCZOS)
        px, py = x + (w - piece.width) // 2, y + (h - piece.height) // 2
        card.paste(piece, (px, py), piece)
        credits.append(credit)
        hotspots.append({"label": label, "confidence": None, "x": round((px + piece.width / 2) / BOARD_SIZE[0], 3),
                         "y": round((py + piece.height / 2) / BOARD_SIZE[1], 3)})
    return card, credits, hotspots


def named(describer, det, crop, image, man: bool = False) -> dict:
    """What the garment really is ("Buzo polo", "Buzo polo de corderito negro"), when the model can tell."""
    description = describer.describe(crop, det.label, image, det.box, det.polygon, man=man) if describer else None
    return {"kind": description.kind, "name": description.name} if description else {}


def style_for(describer, image: Image.Image, kind: str) -> dict:
    """The outfit's style tag (streetwear, old money...), for people photos only."""
    if describer is None or kind not in ("woman", "man"):
        return {}
    return {"style": describer.style(describer._embedder.embed([image])[0], man=kind == "man")}


def hotspots_for(detections, image: Image.Image, describer=None, man: bool = False) -> list[dict]:
    spots = []
    for det, crop in detections[:2]:
        x1, y1, x2, y2 = det.box
        spots.append({"label": det.label, "confidence": det.confidence, **named(describer, det, crop, image, man),
                      "x": round((x1 + x2) / 2 / image.width, 3), "y": round((y1 + y2) / 2 / image.height, 3)})
    return spots


def main() -> None:
    for folder in (PUBLIC, CATALOG):
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True)
    settings = Settings(_env_file=None)
    detector = YoloGarmentDetector(settings.yolo_repo, settings.yolo_file, settings.detect_confidence)
    embedder = ClipEmbedder(settings.clip_model)
    describer = GarmentDescriber(embedder)

    pins, catalog, crops = [], [], []  # crops: (pin number, label, image) for the explainer search

    def add_catalog(image: Image.Image, label: str, credit: dict, pin: int) -> None:
        name = f"item-{len(catalog) + 1:02d}"
        size = save_webp(image, CATALOG, name, CROP_WIDTH)
        catalog.append({"file": f"{name}.webp", **size, "label": label,
                        "title": f"{LABEL_ES.get(label, label)} · foto {pin:02d}", "link": credit["url"],
                        "credit": f"{credit['author']}, {credit['license']}"})
        crops.append((pin, label, image))

    # Interleave women, men and products so every stretch of a carousel is mixed.
    order = []
    for i in range(max(len(WOMEN), len(MEN))):
        order += [("woman", WOMEN[i]), ("man", MEN[i])]
        if i % 4 == 1 and PRODUCTS:
            order.append(("product", list(PRODUCTS)[len([o for o in order if o[0] == "product"]) % len(PRODUCTS)]))
        if i in (4, 9):
            order.append(("board", BOARDS[0 if i == 4 else 1]))
    seen_products = set()

    for kind, item in order:
        n = len(pins) + 1
        if kind == "board":
            card, credits, spots = compose_board(item)
            size = save_webp(card, PUBLIC, f"pin-{n:02d}", PIN_WIDTH)
            pins.append({"src": f"/landing/pin-{n:02d}.webp", **size, "kind": "board", "hotspots": spots, "credits": credits})
            for (title, (l, t, r, b), _, label), credit in zip(item, credits):
                image, _ = commons(title)
                add_catalog(image.crop((round(l * image.width), round(t * image.height),
                                        round(r * image.width), round(b * image.height))), label, credit, n)
            continue
        if kind == "product" and item in seen_products:
            continue
        seen_products.add(item)
        image, credit = commons(item)
        if item in PRODUCT_CROPS:
            l, t, r, b = PRODUCT_CROPS[item]
            image = image.crop((round(l * image.width), round(t * image.height), round(r * image.width), round(b * image.height)))
        detections = [d for d in crop_detections(image, detector.detect(image)) if d[0].confidence >= MIN_CONFIDENCE]
        size = save_webp(image, PUBLIC, f"pin-{n:02d}", PIN_WIDTH)
        fixed_label = PRODUCTS.get(item) if kind == "product" else None
        spots = hotspots_for(detections, image, describer, kind == "man") if not fixed_label else [{"label": fixed_label, "confidence": None, "x": 0.5, "y": 0.5}]
        pins.append({"src": f"/landing/pin-{n:02d}.webp", **size, "kind": kind, **style_for(describer, image, kind),
                     "hotspots": spots, "credits": [credit]})
        if fixed_label:
            add_catalog(image, fixed_label, credit, n)
        else:
            for det, crop in detections:
                add_catalog(crop, det.label, credit, n)

    # Explainer: real boxes on its photo, then the closest garments of the same family elsewhere.
    demo, demo_credit = commons(EXPLAINER)
    demo_size = save_webp(demo, PUBLIC, "scan-demo", DEMO_WIDTH, quality=82)
    scale = demo_size["width"] / demo.width
    boxes = crop_detections(demo, detector.detect(demo))[:2]
    query = next(crop for det, crop in boxes if EXPLAINER_QUERY in det.label)
    explainer_pin = next(p["src"] for p in pins if demo_credit in p["credits"])
    candidates = [(pin, label, img) for pin, label, img in crops
                  if EXPLAINER_QUERY in label and f"pin-{pin:02d}" not in explainer_pin]
    vectors = embedder.embed([query] + [img for _, _, img in candidates])
    ranked = sorted(zip(vectors[1:] @ vectors[0], candidates), key=lambda pair: -pair[0])
    matches, used = [], set()
    for score, (pin, label, img) in ranked:
        if pin in used:
            continue
        used.add(pin)
        size = save_webp(img, PUBLIC, f"match-{len(matches) + 1}", 360)
        description = describer.describe(img, label, img, (0, 0, img.width, img.height))
        matches.append({"src": f"/landing/match-{len(matches) + 1}.webp", **size, "label": label,
                        **({"name": description.kind} if description else {}), "similarity": round(float(score), 2)})
        if len(matches) == 4:
            break

    explainer = {
        "src": "/landing/scan-demo.webp", **demo_size, "credit": demo_credit, "matches": matches,
        "boxes": [{"label": det.label, "confidence": det.confidence, **named(describer, det, crop, demo),
                   "box": [round(v * scale) for v in det.box]} for det, crop in boxes],
    }
    ts = (
        "// Generated by apps/api/scripts/build_landing_assets.py from freely licensed Wikimedia Commons photos.\n"
        "// Hotspots, explainer boxes and similarities are real YOLO / FashionCLIP output.\n\n"
        "export type Credit = { title: string; author: string; license: string; url: string };\n"
        "export type Hotspot = { label: string; confidence: number | null; kind?: string; name?: string; x: number; y: number };\n"
        'export type Pin = { src: string; width: number; height: number; kind: "woman" | "man" | "product" | "board"; style?: string; hotspots: Hotspot[]; credits: Credit[] };\n'
        "export type Match = { src: string; width: number; height: number; label: string; name?: string; similarity: number };\n"
        "export type Explainer = { src: string; width: number; height: number; credit: Credit; matches: Match[];\n"
        "  boxes: { label: string; confidence: number; kind?: string; name?: string; box: [number, number, number, number] }[] };\n\n"
        f"export const PINS: Pin[] = {json.dumps(pins, ensure_ascii=False, indent=2)};\n\n"
        f"export const EXPLAINER: Explainer = {json.dumps(explainer, ensure_ascii=False, indent=2)};\n"
    )
    (WEB / "src" / "lib" / "landing.ts").write_text(ts, encoding="utf-8")
    (CATALOG / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")
    kinds = {k: sum(p["kind"] == k for p in pins) for k in ("woman", "man", "product", "board")}
    print(f"{len(pins)} pins {kinds}, catalog {len(catalog)} items")
    print("explainer", [(b.get("name", b["label"]), b["confidence"]) for b in explainer["boxes"]], [(m["label"], m["similarity"]) for m in matches])


LOCAL_KINDS = {"mujer": "woman", "hombre": "man", "productos": "product"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def build_local(folder: Path) -> None:
    """The landing from your own photos, for `npm run dev` only (the web app ignores it in builds)."""
    from PIL import ImageOps

    out = WEB / "public" / "landing-local"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    photos = lambda sub: sorted(p for p in (folder / sub).glob("*") if p.suffix.lower() in IMAGE_SUFFIXES)
    groups = {kind: photos(sub) for sub, kind in LOCAL_KINDS.items()}
    featured = photos("destacada")  # the first one is the photo at the centre of the hero
    if not any(groups.values()) and not featured:
        raise SystemExit(f"No photos in {folder}: add them to destacada/, mujer/, hombre/ or productos/")

    settings = Settings(_env_file=None)
    detector = YoloGarmentDetector(settings.yolo_repo, settings.yolo_file, settings.detect_confidence)
    embedder = ClipEmbedder(settings.clip_model)
    describer = GarmentDescriber(embedder)
    open_rgb = lambda path: ImageOps.exif_transpose(Image.open(path)).convert("RGB")

    # With a featured photo, the outfits most like it come first, so the pins around it in the hero
    # (the first woman and man) share its look. FashionCLIP judges the likeness.
    if featured:
        reference = embedder.embed([open_rgb(featured[0])])[0]
        for kind in ("woman", "man"):
            if groups[kind]:
                vectors = embedder.embed([open_rgb(path) for path in groups[kind]])
                groups[kind] = [path for _, path in sorted(zip(vectors @ reference, groups[kind]), key=lambda pair: -pair[0])]

    # Alternate women and men, with a product every third pin, so every stretch is mixed.
    order, products = [], list(groups["product"])
    for i in range(max(len(groups["woman"]), len(groups["man"]))):
        order += [("woman", p) for p in groups["woman"][i : i + 1]] + [("man", p) for p in groups["man"][i : i + 1]]
        if i % 2 == 1 and products:
            order.append(("product", products.pop(0)))
    order += [("product", p) for p in products]

    pins, crops, outfits = [], [], []
    for kind, path in order:
        n = len(pins) + 1
        image = open_rgb(path)
        credit = {"title": path.stem, "author": "Tu colección", "license": "Uso local, no se publica", "url": ""}
        detections = [d for d in crop_detections(image, detector.detect(image)) if d[0].confidence >= MIN_CONFIDENCE]
        size = save_webp(image, out, f"pin-{n:02d}", PIN_WIDTH)
        pins.append({"src": f"/landing-local/pin-{n:02d}.webp", **size, "kind": kind, **style_for(describer, image, kind),
                     "hotspots": hotspots_for(detections, image, describer, kind == "man"), "credits": [credit]})
        crops += [(n, det.label, crop) for det, crop in detections]
        if kind != "product" and detections:
            outfits.append((n, image, credit))

    explainer = None
    demo = next((o for o in outfits if len([c for c in crops if c[0] == o[0]]) >= 2), outfits[0] if outfits else None)
    if featured:
        credit = {"title": featured[0].stem, "author": "Tu colección", "license": "Uso local, no se publica", "url": ""}
        demo = (0, open_rgb(featured[0]), credit)  # 0: not one of the pins
    # The two most confident garments, numbered top to bottom so 01 is the one you see first.
    boxes = sorted(crop_detections(demo[1], detector.detect(demo[1]))[:2], key=lambda pair: pair[0].box[1]) if demo else []
    if demo and not boxes:
        print(f"No garments found in {demo[2]['title']}: the hero keeps the published photo")
    if demo and boxes:
        n, image, credit = demo
        size = save_webp(image, out, "scan-demo", DEMO_WIDTH, quality=82)
        scale = size["width"] / image.width
        family = boxes[0][0].label.split("_")[-1]  # outwear, shirt, trousers, dress, skirt...
        others = [c for c in crops if c[0] != n]
        if not others:  # only a featured photo: find its matches in the bundled demo catalog
            items = json.loads((settings.demo_catalog_dir / "catalog.json").read_text(encoding="utf-8"))
            others = [(-1, item["label"], open_rgb(settings.demo_catalog_dir / item["file"])) for item in items]
        same = [c for c in others if c[1].endswith(family)] or others
        vectors = embedder.embed([boxes[0][1]] + [img for _, _, img in same]) if same else None
        matches = []
        if vectors is not None:
            group = family_of(boxes[0][0].label)
            scored = [(score, item, vector) for score, item, vector in zip(vectors[1:] @ vectors[0], same, vectors[1:])
                      if score >= SIMILARITY_FLOOR and (group is None or describer.belongs(vector, group))]
            for score, (_, label, img), _ in sorted(scored, key=lambda p: -p[0])[:4]:
                match_size = save_webp(img, out, f"match-{len(matches) + 1}", 360)
                description = describer.describe(img, label, img, (0, 0, img.width, img.height))
                matches.append({"src": f"/landing-local/match-{len(matches) + 1}.webp", **match_size, "label": label,
                                **({"name": description.kind} if description else {}), "similarity": round(float(score), 2)})
        explainer = {
            "src": "/landing-local/scan-demo.webp", **size, "credit": credit, "matches": matches,
            "boxes": [{"label": d.label, "confidence": d.confidence, **named(describer, d, c, image),
                       "box": [round(v * scale) for v in d.box]} for d, c in boxes],
        }
    (out / "manifest.json").write_text(json.dumps({"pins": pins, "explainer": explainer}, ensure_ascii=False), encoding="utf-8")
    kinds = {k: sum(p["kind"] == k for p in pins) for k in ("woman", "man", "product")}
    print(f"{len(pins)} local pins {kinds} → {out}")
    if explainer:
        print("hero photo", explainer["credit"]["title"], [(b.get("name", b["label"]), b["confidence"]) for b in explainer["boxes"]])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--local", type=Path, help="build from your own folder (mujer/, hombre/, productos/)")
    args = parser.parse_args()
    build_local(args.local.resolve()) if args.local else main()
