FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models \
    YOLO_CONFIG_DIR=/models/ultralytics

# OpenCV (pulled in by ultralytics) needs these shared libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only torch first: the default Linux wheel ships CUDA and weighs several GB.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
