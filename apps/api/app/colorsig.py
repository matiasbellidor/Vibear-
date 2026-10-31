"""A garment picture's main colour, for ranking search results by colour as well as by look.

CLIP sees shape and texture well, but two sweaters of the same cut score almost the same whatever
their colour. The signature is the median CIELAB colour of the middle of the picture, without a
studio's white background, so a navy result can rank above a camel one for a navy crop.
"""

import numpy as np
from PIL import Image

# sRGB (D65) to XYZ, then XYZ to CIELAB.
_RGB_TO_XYZ = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WHITE = np.array([0.95047, 1.0, 1.08883])
_EPSILON = (6 / 29) ** 3


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """(..., 3) sRGB values 0-255 to CIELAB (L 0-100)."""
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = (c @ _RGB_TO_XYZ.T) / _WHITE
    f = np.where(xyz > _EPSILON, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def color_signature(image: Image.Image) -> np.ndarray:
    """Median CIELAB colour of the picture's middle 60%, leaving out a white studio background.

    A white garment keeps its white: when almost everything is white, the white is the garment.
    """
    small = image.convert("RGB")
    small.thumbnail((64, 64))
    pixels = np.asarray(small, dtype=float)
    h, w = pixels.shape[:2]
    core = pixels[int(h * 0.2) : max(int(h * 0.8), int(h * 0.2) + 1), int(w * 0.2) : max(int(w * 0.8), int(w * 0.2) + 1)]
    lab = to_lab(core.reshape(-1, 3))
    studio = (lab[:, 0] > 93) & (np.hypot(lab[:, 1], lab[:, 2]) < 6)
    product = lab[~studio]
    if len(product) < len(lab) * 0.15:
        product = lab
    return np.median(product, axis=0)


def color_affinity(a: np.ndarray, b: np.ndarray, sigma: float = 25.0) -> float:
    """1 for the same colour, falling towards 0 as they drift apart (CIE76 distance, Gaussian)."""
    return float(np.exp(-((np.linalg.norm(a - b) / sigma) ** 2)))
