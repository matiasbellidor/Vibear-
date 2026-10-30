from pydantic import BaseModel, Field

from app.storage import ID_PATTERN


class DetectedItem(BaseModel):
    crop_id: str
    label: str  # DeepFashion2 class, or "full_image" when nothing was detected
    confidence: float | None
    box: tuple[int, int, int, int]
    crop_url: str
    # What it really is, in Spanish (app/ml/describe.py): "Buzo polo de corderito negro" / "Buzo polo".
    name: str | None = None
    kind: str | None = None
    brand: str | None = None  # a hint from the image alone, only when the model is very sure


class DetectResponse(BaseModel):
    image_id: str
    width: int
    height: int
    items: list[DetectedItem]


class SearchRequest(BaseModel):
    crop_id: str = Field(pattern=ID_PATTERN)
    limit: int = Field(default=24, ge=1, le=60)
    label: str | None = Field(default=None, max_length=40, pattern=r"^[a-z_]+$")  # the garment's YOLO class


class Match(BaseModel):
    title: str
    link: str
    source: str | None
    thumbnail: str | None
    thumbnail_width: int | None = None
    thumbnail_height: int | None = None
    price: str | None
    similarity: float | None


class BrandGuess(BaseModel):
    name: str
    count: int  # results that mention it
    total: int  # results read


class SearchResponse(BaseModel):
    crop_id: str
    cached: bool
    results: list[Match]
    brand: BrandGuess | None = None  # the brand most results agree on (real search only)


class SavedProduct(Match):
    savedAt: int  # epoch ms, set by the browser (same shape as the web app's SavedItem)


class Closet(BaseModel):
    """One browser's saved products. updated_at (epoch ms) decides which copy wins."""

    items: list[SavedProduct] = Field(default_factory=list, max_length=500)
    updated_at: int = Field(default=0, ge=0)
