from functools import partial
from urllib.parse import quote

import anyio
import boto3
from botocore.config import Config

from eventopia.config import S3Section
from eventopia.storage.base import ObjectStorage


class S3ObjectStorage(ObjectStorage):
    def __init__(self, s3_config: S3Section) -> None:
        self._bucket = s3_config["bucket"]
        self._endpoint_url = s3_config["endpoint_url"].rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=self._endpoint_url,
            aws_access_key_id=s3_config["access_key"],
            aws_secret_access_key=s3_config["secret_key"],
            region_name=s3_config["region"],
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
        self._closed = False

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await anyio.to_thread.run_sync(
            partial(
                self._client.put_object,
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        )

    async def delete(self, key: str) -> None:
        await anyio.to_thread.run_sync(
            partial(self._client.delete_object, Bucket=self._bucket, Key=key)
        )

    def public_url(self, key: str) -> str:
        return f"{self._endpoint_url}/{quote(self._bucket, safe='')}/{quote(key)}"

    async def close(self) -> None:
        if not self._closed:
            self._closed = True
            await anyio.to_thread.run_sync(self._client.close)
