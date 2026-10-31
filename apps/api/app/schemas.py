from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

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
    similar: str | None = None  # no brand: whose signature design it resembles ("Símil Polo Ralph Lauren")
    color: str | None = None  # its main colour's name ("azul marino"), to check it against a colour palette


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


# The anonymous profile: the style test's answers and the colour analysis, as short keys (the web app
# owns their meaning, lib/style.ts and lib/colorimetry.ts). Keys are checked for shape, not meaning.
Key = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,32}$")]


class StyleAnswers(BaseModel):
    dress: Key | None = None  # who they shop for: mujer, hombre, ambos
    aesthetics: list[Key] = Field(default_factory=list, max_length=8)
    lifestyle: list[Key] = Field(default_factory=list, max_length=8)
    goals: list[Key] = Field(default_factory=list, max_length=8)
    budget: Key | None = None


class ColorResult(BaseModel):
    season: Key  # "otono-suave"
    undertone: Key
    contrast: Key
    chroma: Key


class Profile(BaseModel):
    """One browser's profile. `user` is the id the browser made up on its first visit, kept here too so
    it comes back if the browser's storage is wiped. updated_at (epoch ms) decides which copy wins."""

    user: Annotated[str, StringConstraints(pattern=r"^[0-9a-f-]{36}$")] | None = None
    status: Literal["new", "done", "skipped"] = "new"
    style: StyleAnswers | None = None
    color: ColorResult | None = None
    updated_at: int = Field(default=0, ge=0)


Point = tuple[float, float]  # x, y as fractions of the photo's width and height


class Body(BaseModel):
    """A full-body photo's keypoints (shoulders, hips, knees, ankles, nose when seen)."""

    width: int
    height: int
    keypoints: dict[str, Point]


class Garment(BaseModel):
    slot: str  # where it goes: top, outer, bottom or dress
    label: str | None  # YOLO's class; None for a product shot cut from its white background
    name: str | None  # what it is, in Spanish, when the model can tell
    image: str  # the cut-out, transparent around it (a data: URL; nothing is stored)
    box: tuple[float, float, float, float]  # where it was in the photo (fractions), for placing it


class Garments(BaseModel):
    width: int
    height: int
    pose: dict[str, Point] | None  # the person wearing them, when there was one: anchors the fit
    items: list[Garment]


class Closet(BaseModel):
    """One browser's saved products. updated_at (epoch ms) decides which copy wins."""

    items: list[SavedProduct] = Field(default_factory=list, max_length=500)
    updated_at: int = Field(default=0, ge=0)
