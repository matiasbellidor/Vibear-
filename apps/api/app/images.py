import asyncio
import io
import ipaddress
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1600
MAX_REDIRECTS = 3


class ImageError(ValueError):
    """The input is not a usable image (bad format, too big, unreachable URL)."""


def decode_image(data: bytes) -> Image.Image:
    """Bytes -> upright RGB image, downscaled so the longest side is at most MAX_SIDE."""
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageError("File is not a valid image") from exc
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    return image


def encode_jpeg(image: Image.Image, max_bytes: int | None = None) -> bytes:
    """Encode as JPEG, lowering quality and then size until it fits in max_bytes."""
    quality = 90
    while True:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=quality)
        data = buffer.getvalue()
        if max_bytes is None or len(data) <= max_bytes:
            return data
        if quality > 60:
            quality -= 10
        else:
            image = image.resize((max(1, image.width * 3 // 4), max(1, image.height * 3 // 4)))


async def fetch_image(url: str, max_bytes: int, client: httpx.AsyncClient) -> bytes:
    """Download an image from a public URL. Every redirect hop is checked against private IPs (SSRF)."""
    for _ in range(MAX_REDIRECTS + 1):
        await _ensure_public_url(url)
        async with client.stream("GET", url, follow_redirects=False, timeout=10) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers["location"])
                continue
            if response.status_code != 200:
                raise ImageError(f"Image URL answered HTTP {response.status_code}")
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > max_bytes:
                    raise ImageError("Image is too large")
            return bytes(data)
    raise ImageError("Too many redirects")


async def _ensure_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ImageError("Only http(s) image URLs are allowed")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, parsed.port or 443)
    except OSError as exc:
        raise ImageError("Could not resolve the image host") from exc
    for info in infos:
        address = ipaddress.ip_address(info[4][0].split("%")[0])
        if not address.is_global:
            raise ImageError("Image URL points to a private address")
