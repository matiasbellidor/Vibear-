from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SerpApi Google Lens. Without a key, /v1/search answers 503 (or fake results if demo_search is on).
    serpapi_api_key: str = ""
    demo_search: bool = False
    demo_catalog_dir: Path = Path(__file__).parent / "demo_catalog"
    serpapi_country: str = "ar"
    serpapi_hl: str = "es-419"
    search_cache_hours: int = 72

    # Models are downloaded from the Hugging Face Hub on first start (HF_HOME sets the cache).
    yolo_repo: str = "Bingsu/adetailer"
    yolo_file: str = "deepfashion2_yolov8s-seg.pt"
    clip_model: str = "patrickjohncyh/fashion-clip"
    accessory_repo: str = "valentinafeve/yolos-fashionpedia"  # shoes, bags, glasses, hats, belts (MIT)
    pose_repo: str = "Ultralytics/YOLO11"  # body keypoints for the fitting room
    pose_file: str = "yolo11n-pose.pt"
    detect_confidence: float = 0.35

    data_dir: Path = Path("data")
    max_upload_mb: int = 10
    cors_origins: list[str] = ["http://localhost:3000"]
