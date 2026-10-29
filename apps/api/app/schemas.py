from pydantic import BaseModel, Field

from app.storage import ID_PATTERN


class DetectedItem(BaseModel):
    crop_id: str
    label: str  # DeepFashion2 class, or "full_image" when nothing was detected
    confidence: float | None
    box: tuple[int, int, int, int]
    crop_url: str


class DetectResponse(BaseModel):
    image_id: str
    width: int
    height: int
    items: list[DetectedItem]


class SearchRequest(BaseModel):
    crop_id: str = Field(pattern=ID_PATTERN)
    limit: int = Field(default=24, ge=1, le=60)


class Match(BaseModel):
    title: str
    link: str
    source: str | None
    thumbnail: str | None
    thumbnail_width: int | None = None
    thumbnail_height: int | None = None
    price: str | None
    similarity: float | None


class SearchResponse(BaseModel):
    crop_id: str
    cached: bool
    results: list[Match]
