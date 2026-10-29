"""Rebuild the landing page photos and apps/web/src/lib/landing.ts.

Downloads the curated, freely licensed Wikimedia Commons photos below (with their credits), saves
them as small WebP files, and computes the scan explainer from real model output: YOLO boxes on
the demo photo, and FashionCLIP similarity between its dress and the dresses in the other photos.

Run from apps/api with the API's venv (needs network and the models):
    python scripts/build_landing_assets.py
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import USER_AGENT  # noqa: E402
from app.ml.detector import YoloGarmentDetector, crop_detections  # noqa: E402
from app.ml.embedder import ClipEmbedder  # noqa: E402

WEB = Path(__file__).resolve().parents[2] / "web"
OUT = WEB / "public" / "landing"

# Curated by hand: one clear outfit per photo, no visible brand logos, no celebrities.
PHOTOS = [
    "File:NY Fashion Week 2015 (21412569462).jpg",  # the explainer photo (first)
    "File:New York Fashion Week September 2016 (29594907275).jpg",
    "File:New York Fashion Week September 2016 (29514204891).jpg",
    "File:New York Fashion Week September 2016 (29595075045).jpg",
    "File:NY fashion week 2013, day1 (9680723237).jpg",
    "File:New York Fashion Week September 2016 (29514216591).jpg",
    "File:London Fashion Week Men's Strand January 2017 05.jpg",
    "File:New York Fashion Week September 2016 (28971442993).jpg",
    "File:New York Fashion Week September 2018 (43841560134).jpg",
    "File:NY Fashion Week 2014, day4 (15170716941).jpg",
    "File:New York Fashion Week September 2016 (29514225211).jpg",
    "File:Millennial streetwear in Qingdao in 2025.jpg",
    "File:NY Fashion Week 2014, day4 (14987106717).jpg",
    "File:New York Fashion Week September 2016 (28971466273).jpg",
    "File:Anarchic-pieces.jpg",
    "File:Street Style at London Fashion Week 02.jpg",
    "File:NY fashion week 2013, day1 (9683974414).jpg",
    "File:Japanese gen Z streetwear in 2025.jpg",
    "File:New York Fashion Week September 2016 (28969473384).jpg",
    "File:NY fashion week 2013, day1 (9683922292).jpg",
    "File:New York Fashion Week September 2016 (29560676216).jpg",
    "File:Gen Z streetwear in Qingdao in 2025.jpg",
    "File:NY Fashion Week 2014, day4 (15150649676).jpg",
    "File:Street Style at London Fashion Week 04.jpg",
    "File:NY fashion week 2013, day1 (9680746137).jpg",
    "File:Street Style at London Fashion Week 07.jpg",
]
EXPLAINER_BOXES = 2  # the dress and the coat next to it; further boxes repeat the coat
PHOTO_WIDTH, DEMO_WIDTH, MATCH_WIDTH = 400, 720, 360


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def commons(title: str) -> tuple[Image.Image, dict]:
    params = {"action": "query", "titles": title, "prop": "imageinfo", "format": "json",
              "iiprop": "url|extmetadata", "iiurlwidth": 960}
    page = next(iter(json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
                     ["query"]["pages"].values()))
    info = page["imageinfo"][0]
    meta = info["extmetadata"]
    artist = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
    credit = {
        "title": title.removeprefix("File:").rsplit(".", 1)[0],
        "author": artist or "Unknown",
        "license": meta["LicenseShortName"]["value"],
        "url": info["descriptionurl"],
    }
    return Image.open(BytesIO(fetch(info["thumburl"]))).convert("RGB"), credit


def save_webp(image: Image.Image, name: str, width: int) -> dict:
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    image.save(OUT / f"{name}.webp", "WEBP", quality=70, method=6)
    return {"src": f"/landing/{name}.webp", "width": image.width, "height": image.height}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    settings = Settings(_env_file=None)
    detector = YoloGarmentDetector(settings.yolo_repo, settings.yolo_file, settings.detect_confidence)
    embedder = ClipEmbedder(settings.clip_model)

    photos, dresses = [], []
    for n, title in enumerate(PHOTOS, start=1):
        image, credit = commons(title)
        photos.append({**save_webp(image, f"look-{n:02d}", PHOTO_WIDTH), "credit": credit})
        if n == 1:
            demo = image
            continue
        for det, crop in crop_detections(image, detector.detect(image)):
            if det.label.endswith("dress"):  # the explainer searches a dress: compare it with dresses
                dresses.append((n, det, crop))

    demo_asset = save_webp(demo, "scan-demo", DEMO_WIDTH)
    scale = demo_asset["width"] / demo.width
    boxes = crop_detections(demo, detector.detect(demo))[:EXPLAINER_BOXES]
    vectors = embedder.embed([boxes[0][1]] + [crop for _, _, crop in dresses])
    ranked = sorted(zip(vectors[1:] @ vectors[0], dresses), key=lambda pair: -pair[0])

    matches, used = [], set()
    for score, (n, det, crop) in ranked:
        if n in used:
            continue  # one garment per photo, so the cards read as different products
        used.add(n)
        asset = save_webp(crop, f"match-{len(matches) + 1}", MATCH_WIDTH)
        matches.append({**asset, "label": det.label, "similarity": round(float(score), 2), "photo": n})
        if len(matches) == 4:
            break

    explainer = {
        **demo_asset,
        "credit": photos[0]["credit"],
        "boxes": [
            {"label": det.label, "confidence": det.confidence, "box": [round(v * scale) for v in det.box]}
            for det, _ in boxes
        ],
        "matches": matches,
    }
    ts = (
        "// Generated by apps/api/scripts/build_landing_assets.py from freely licensed Wikimedia Commons photos.\n"
        "// Explainer boxes and similarities are real YOLO / FashionCLIP output, not invented numbers.\n\n"
        "export type Credit = { title: string; author: string; license: string; url: string };\n"
        "export type Photo = { src: string; width: number; height: number; credit: Credit };\n"
        "export type Match = { src: string; width: number; height: number; label: string; similarity: number; photo: number };\n"
        "export type Explainer = Photo & {\n"
        "  boxes: { label: string; confidence: number; box: [number, number, number, number] }[];\n"
        "  matches: Match[];\n"
        "};\n\n"
        f"export const PHOTOS: Photo[] = {json.dumps(photos, ensure_ascii=False, indent=2)};\n\n"
        f"export const EXPLAINER: Explainer = {json.dumps(explainer, ensure_ascii=False, indent=2)};\n"
    )
    (WEB / "src" / "lib" / "landing.ts").write_text(ts, encoding="utf-8")
    print(f"{len(photos)} photos, matches {[(m['label'], m['similarity']) for m in matches]}")


if __name__ == "__main__":
    main()
