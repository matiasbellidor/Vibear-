from PIL import Image

from app.ml.detector import Detection

# Fashionpedia's classes that the garment detector (DeepFashion2: clothes only) can't see -> our labels.
ACCESSORIES = {
    "shoe": "shoes",
    "bag, wallet": "bag",
    "glasses": "glasses",
    "hat": "hat",
    "belt": "belt",
    "watch": "watch",
    "scarf": "scarf",
    "headband, head covering, hair accessory": "headband",
}
# Calibrated on real photos: shoes and bags score 0.6-0.98 when they're there; below 0.45 it's guessing
# (a glove where there is a sleeve, a belt across a bag's strap).
MIN_SCORE = 0.45
MAX_SIDE = 800  # the model sees the photo at this size; boxes are scaled back


def _same(a, b) -> bool:
    """Two boxes of one thing: they overlap a lot, or one sits inside the other (half a boot, the
    buckle's part of a belt)."""
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a, area_b = (a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return bool(union) and (inter / union > 0.3 or inter / max(1, min(area_a, area_b)) > 0.6)


def merge(found: list[Detection]) -> list[Detection]:
    """One box per thing: overlapping boxes of a class keep the surest; the two shoes of a pair
    (side by side, at the same height) become one, which is what you'd search for."""
    kept: list[Detection] = []
    for det in sorted(found, key=lambda d: d.confidence, reverse=True):
        if not any(k.label == det.label and _same(k.box, det.box) for k in kept):
            kept.append(det)
    shoes = [d for d in kept if d.label == "shoes"]
    others = [d for d in kept if d.label != "shoes"]
    paired: list[Detection] = []
    for shoe in shoes:
        mate = next((p for p in paired if _a_pair(p.box, shoe.box)), None)
        if mate is None:
            paired.append(shoe)
            continue
        box = (min(mate.box[0], shoe.box[0]), min(mate.box[1], shoe.box[1]), max(mate.box[2], shoe.box[2]), max(mate.box[3], shoe.box[3]))
        paired[paired.index(mate)] = Detection("shoes", max(mate.confidence, shoe.confidence), box)
    # A leftover piece inside a pair (the toe of one boot) is the same pair.
    paired = [p for p in paired if not any(q is not p and q.confidence >= p.confidence and _same(q.box, p.box) for q in paired)]
    return others + paired


def _a_pair(a, b) -> bool:
    height = max(a[3] - a[1], b[3] - b[1])
    overlap = min(a[3], b[3]) - max(a[1], b[1])
    gap = max(a[0], b[0]) - min(a[2], b[2])  # negative when they overlap sideways
    return overlap > 0.3 * height and gap < max(a[2] - a[0], b[2] - b[0])


class AccessoryDetector:
    """YOLOS fine-tuned on Fashionpedia (MIT): shoes, bags, glasses, hats, belts, watches, scarves."""

    def __init__(self, repo_id: str):
        # Heavy imports stay here so tests and the rest of the app never load torch.
        import torch
        from transformers import AutoImageProcessor, AutoModelForObjectDetection

        self._torch = torch
        self._processor = AutoImageProcessor.from_pretrained(repo_id)
        self._model = AutoModelForObjectDetection.from_pretrained(repo_id).eval()

    def detect(self, image: Image.Image) -> list[Detection]:
        scale = min(1.0, MAX_SIDE / max(image.size))
        small = image.resize((round(image.width * scale), round(image.height * scale))) if scale < 1 else image
        with self._torch.no_grad():
            outputs = self._model(**self._processor(images=small, return_tensors="pt"))
        result = self._processor.post_process_object_detection(outputs, threshold=MIN_SCORE, target_sizes=[small.size[::-1]])[0]
        found = []
        for score, label, box in zip(result["scores"].tolist(), result["labels"].tolist(), result["boxes"].tolist()):
            name = ACCESSORIES.get(self._model.config.id2label[int(label)])
            if name:
                x1, y1, x2, y2 = (max(0, round(v / scale)) for v in box)
                found.append(Detection(name, round(score, 3), (x1, y1, min(image.width, x2), min(image.height, y2))))
        return merge(found)


class FashionDetector:
    """Clothes from YOLO DeepFashion2 (with their outlines) plus shoes and accessories from YOLOS."""

    def __init__(self, garments, accessories):
        self._garments = garments
        self._accessories = accessories

    def detect(self, image: Image.Image) -> list[Detection]:
        return self._garments.detect(image) + self._accessories.detect(image)
