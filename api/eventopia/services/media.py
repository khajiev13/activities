import logging
import re
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4

from eventopia.config import AppSection, S3Section
from eventopia.exceptions import ValidationError
from eventopia.storage.base import ObjectStorage

_logger = logging.getLogger(__name__)
_MEDIA_PATH = re.compile(
    r"(?:teams|organizations)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)"
)


def detect_image_type(data: bytes) -> tuple[str, str] | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


class MediaService:
    def __init__(
        self, storage: ObjectStorage, app_config: AppSection, s3_config: S3Section
    ) -> None:
        self._storage = storage
        self._public_base_url = app_config["public_base_url"].rstrip("/")
        self._public_prefix = s3_config["public_prefix"].strip("/")
        self._max_upload_bytes = s3_config["max_upload_bytes"]

    async def upload_image(
        self, kind: Literal["teams", "organizations"], data: bytes
    ) -> str:
        if kind not in ("teams", "organizations"):
            raise ValidationError("Invalid media kind")
        if not data or len(data) > self._max_upload_bytes:
            raise ValidationError("Image is empty or exceeds the upload size limit")
        detected = detect_image_type(data)
        if detected is None:
            raise ValidationError("Only JPEG, PNG and WebP images are supported")
        content_type, extension = detected
        key = f"{self._public_prefix}/{kind}/{uuid4()}.{extension}"
        await self._storage.put(key, data, content_type)
        return f"{self._public_base_url}/media/{key}"

    async def delete_by_url(self, url: str | None) -> None:
        if not url:
            return
        try:
            parsed = urlsplit(url)
            base = urlsplit(self._public_base_url)
            prefix = f"{base.path}/media/{self._public_prefix}/"
            if (
                (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc)
                or parsed.query
                or parsed.fragment
                or not parsed.path.startswith(prefix)
            ):
                return
            media_path = parsed.path.removeprefix(prefix)
            if _MEDIA_PATH.fullmatch(media_path) is None:
                return
            await self._storage.delete(f"{self._public_prefix}/{media_path}")
        except Exception:
            # Upstream exception messages and object URLs may contain secrets.
            _logger.warning("Media deletion failed")
