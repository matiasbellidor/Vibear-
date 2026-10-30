from dataclasses import dataclass

from PIL import Image

MAX_ITEMS = 6
# DeepFashion2's classes. Anything else (shoes, bags...) comes from app/ml/accessories.py.
GARMENT_LABELS = {
    "short_sleeved_shirt", "long_sleeved_shirt", "short_sleeved_outwear", "long_sleeved_outwear", "vest", "sling",
    "shorts", "trousers", "skirt", "short_sleeved_dress", "long_sleeved_dress", "vest_dress", "sling_dress",
}


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    box: tuple[int, int, int, int]  # x1, y1, x2, y2 in pixels
    # The garment's outline from the segmentation head, in image pixels (colour is read inside it).
    polygon: tuple[tuple[float, float], ...] | None = None


class YoloGarmentDetector:
    """YOLOv8 fine-tuned on DeepFashion2 (13 garment classes: shirts, outerwear, trousers, skirts, dresses...)."""

    def __init__(self, repo_id: str, filename: str, confidence: float):
        # Heavy imports stay here so tests and the rest of the app never load torch.
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO

        self._model = YOLO(hf_hub_download(repo_id, filename))
        self._confidence = confidence

    def detect(self, image: Image.Image) -> list[Detection]:
        # agnostic_nms: one box per region, even if two classes (shirt / outerwear) both fire on it.
        result = self._model.predict(image, conf=self._confidence, agnostic_nms=True, verbose=False)[0]
        boxes = result.boxes
        outlines = result.masks.xy if result.masks is not None else [None] * len(boxes)
        return [
            Detection(
                result.names[int(cls)],
                round(conf, 3),
                tuple(round(v) for v in xyxy),
                tuple((float(x), float(y)) for x, y in outline) if outline is not None and len(outline) else None,
            )
            for xyxy, conf, cls, outline in zip(boxes.xyxy.tolist(), boxes.conf.tolist(), boxes.cls.tolist(), outlines)
        ]


def crop_detections(
    image: Image.Image,
    detections: list[Detection],
    pad: float = 0.08,
    min_area_ratio: float = 0.01,
) -> list[tuple[Detection, Image.Image]]:
    """Crop each detection with some padding (context helps visual search); drop tiny boxes."""
    width, height = image.size
    kept = []
    for det in sorted(detections, key=lambda d: d.confidence, reverse=True):
        x1, y1, x2, y2 = det.box
        # Shoes, a belt or sunglasses are small in a full-body photo and still worth finding.
        floor = min_area_ratio if det.label in GARMENT_LABELS else min_area_ratio / 5
        if (x2 - x1) * (y2 - y1) < floor * width * height:
            continue
        dx, dy = (x2 - x1) * pad, (y2 - y1) * pad
        box = (
            max(0, round(x1 - dx)),
            max(0, round(y1 - dy)),
            min(width, round(x2 + dx)),
            min(height, round(y2 + dy)),
        )
        kept.append((Detection(det.label, det.confidence, box, det.polygon), image.crop(box)))
    return kept[:MAX_ITEMS]
