from PIL import Image

# The COCO keypoints YOLO pose returns that the fitting room uses (index -> name).
KEYPOINTS = {
    0: "nose",
    5: "left_shoulder", 6: "right_shoulder",
    11: "left_hip", 12: "right_hip",
    13: "left_knee", 14: "right_knee",
    15: "left_ankle", 16: "right_ankle",
}
MIN_CONFIDENCE = 0.3  # below this a keypoint is a guess (a hidden ankle, a cropped head)


class YoloPose:
    """YOLO11 pose (COCO's 17 body keypoints): where a person's shoulders, hips, knees and ankles are."""

    def __init__(self, repo_id: str, filename: str):
        # Heavy imports stay here so tests and the rest of the app never load torch.
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO

        self._model = YOLO(hf_hub_download(repo_id, filename))

    def keypoints(self, image: Image.Image) -> dict[str, tuple[float, float]] | None:
        """The biggest person's confident keypoints, in image pixels; None when there's nobody."""
        result = self._model.predict(image, verbose=False)[0]
        if result.keypoints is None or len(result.boxes) == 0:
            return None
        areas = [(x2 - x1) * (y2 - y1) for x1, y1, x2, y2 in result.boxes.xyxy.tolist()]
        person = max(range(len(areas)), key=areas.__getitem__)
        points = result.keypoints.xy[person].tolist()
        confidence = result.keypoints.conf[person].tolist() if result.keypoints.conf is not None else [1.0] * len(points)
        return {
            name: (round(points[i][0], 1), round(points[i][1], 1))
            for i, name in KEYPOINTS.items()
            if confidence[i] >= MIN_CONFIDENCE
        }
