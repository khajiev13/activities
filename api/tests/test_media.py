import importlib
import logging
import re
import threading
from pathlib import Path

import httpx
import pytest

from eventopia.context.request_id import configure_logging
from eventopia.exceptions import ValidationError
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.wiring import Container, build_bot_container, build_container

_FIXTURES = Path(__file__).parent / "fixtures"
_OWNED_URL = (
    "http://localhost:5173/media/public/teams/"
    "12345678-1234-4234-8234-123456789abc.png"
)


def feature(module, name):
    try:
        return getattr(importlib.import_module(module), name)
    except (ImportError, AttributeError):
        pytest.fail(f"Missing media feature: {module}.{name}", pytrace=False)


@pytest.fixture
def fake_storage():
    return feature("eventopia.storage.fake", "FakeObjectStorage")()


@pytest.fixture
def media(fake_storage, config):
    return feature("eventopia.services.media", "MediaService")(
        fake_storage, config["app"], config["s3"]
    )


@pytest.mark.parametrize(
    ("fixture", "ctype", "extension"),
    [("tiny.jpg", "image/jpeg", "jpg"), ("tiny.png", "image/png", "png"),
     ("tiny.webp", "image/webp", "webp")],
)
@pytest.mark.parametrize("kind", ["teams", "organizations"])
async def test_upload_detects_type_and_builds_url(
    media, fake_storage, fixture, ctype, extension, kind
):
    data = (_FIXTURES / fixture).read_bytes()
    url = await media.upload_image(kind, data)
    assert re.fullmatch(
        rf"http://localhost:5173/media/public/{kind}/[0-9a-f-]{{36}}\.{extension}", url
    )
    key = url.removeprefix("http://localhost:5173/media/")
    assert fake_storage.objects == {key: (data, ctype)}


@pytest.mark.parametrize("data", [
    b"GIF89a", b"plain text", b"", b"\xff\xd8", b"\x89PNG", b"RIFF1234WAVE"
])
async def test_rejects_non_image_and_empty_data(media, fake_storage, data):
    with pytest.raises(ValidationError) as caught:
        await media.upload_image("teams", data)
    assert caught.value.code == 201
    assert caught.value.http_status == 422
    assert not fake_storage.objects


async def test_rejects_over_5mb_and_accepts_boundary(media, fake_storage):
    data = (_FIXTURES / "tiny.png").read_bytes()
    with pytest.raises(ValidationError) as caught:
        await media.upload_image("teams", data.ljust(5_242_881, b"\0"))
    assert caught.value.code == 201
    assert not fake_storage.objects
    await media.upload_image("teams", data.ljust(5_242_880, b"\0"))
    assert len(next(iter(fake_storage.objects.values()))[0]) == 5_242_880


async def test_uses_configured_prefix_base_and_size(fake_storage, config):
    config["app"]["public_base_url"] = "https://example.test/app/"
    config["s3"]["public_prefix"] = "pictures"
    data = (_FIXTURES / "tiny.png").read_bytes()
    config["s3"]["max_upload_bytes"] = len(data)
    media = feature("eventopia.services.media", "MediaService")(
        fake_storage, config["app"], config["s3"]
    )
    url = await media.upload_image("organizations", data)
    assert url.startswith("https://example.test/app/media/pictures/organizations/")
    with pytest.raises(ValidationError):
        await media.upload_image("organizations", data + b"x")
    await media.delete_by_url(url)
    assert not fake_storage.objects


async def test_rejects_invalid_kind(media, fake_storage):
    with pytest.raises(ValidationError):
        await media.upload_image("../private", (_FIXTURES / "tiny.png").read_bytes())
    assert not fake_storage.objects


async def test_delete_owned_url_and_missing_object(media, fake_storage):
    key = _OWNED_URL.removeprefix("http://localhost:5173/media/")
    await fake_storage.put(key, b"test", "image/png")
    await media.delete_by_url(_OWNED_URL)
    await media.delete_by_url(_OWNED_URL)
    assert not fake_storage.objects


@pytest.mark.parametrize("url", [
    None, "", _OWNED_URL.replace("localhost:5173", "foreign.test"),
    _OWNED_URL.replace("localhost:5173", "localhost:5173@foreign.test"),
    _OWNED_URL.replace("/public/", "/private/"),
    _OWNED_URL.replace("/teams/", "/teams/../organizations/"),
    _OWNED_URL.replace("/teams/", "/teams/%2e%2e/"),
    _OWNED_URL.replace(".png", ".txt"), _OWNED_URL + "?download=1", "http://[invalid",
])
async def test_delete_ignores_unowned_urls(media, fake_storage, url):
    key = _OWNED_URL.removeprefix("http://localhost:5173/media/")
    await fake_storage.put(key, b"preserve", "image/png")
    await media.delete_by_url(url)
    assert fake_storage.objects == {key: (b"preserve", "image/png")}


async def test_delete_by_url_never_raises_or_logs_private_details(config, caplog):
    base = feature("eventopia.storage.fake", "FakeObjectStorage")

    class FailingStorage(base):
        async def delete(self, key):
            raise RuntimeError("TEST_ONLY_PRIVATE_STORAGE_DETAIL " + key)

    media = feature("eventopia.services.media", "MediaService")(
        FailingStorage(), config["app"], config["s3"]
    )
    await media.delete_by_url(_OWNED_URL)
    assert any("delet" in record.getMessage().lower() for record in caplog.records)
    if "TEST_ONLY_PRIVATE_STORAGE_DETAIL" in caplog.text or _OWNED_URL in caplog.text:
        pytest.fail("Media cleanup exposed private details", pytrace=False)


async def test_s3_config_and_blocking_calls_run_in_worker(config, monkeypatch):
    import boto3

    calls = []
    main_thread = threading.get_ident()

    class Client:
        def put_object(self, **kwargs):
            calls.append(("put", threading.get_ident(), kwargs))

        def delete_object(self, **kwargs):
            calls.append(("delete", threading.get_ident(), kwargs))

        def close(self):
            calls.append(("close", threading.get_ident(), {}))

    def client(service, **kwargs):
        assert service == "s3"
        assert kwargs["endpoint_url"] == config["s3"]["endpoint_url"]
        assert kwargs["region_name"] == "us-east-1"
        assert kwargs["aws_access_key_id"] == config["s3"]["access_key"]
        assert kwargs["aws_secret_access_key"] == config["s3"]["secret_key"]
        options = kwargs["config"]
        assert options.signature_version == "s3v4"
        assert options.s3 == {"addressing_style": "path"}
        assert options.request_checksum_calculation == "when_required"
        assert options.response_checksum_validation == "when_required"
        return Client()

    monkeypatch.setattr(boto3, "client", client)
    storage = feature("eventopia.storage.s3", "S3ObjectStorage")(config["s3"])
    await storage.put("public/teams/test.png", b"image", "image/png")
    await storage.delete("public/teams/test.png")
    await storage.close()
    await storage.close()
    assert [name for name, _, _ in calls] == ["put", "delete", "close"]
    assert all(thread != main_thread for _, thread, _ in calls)
    assert calls[0][2] == {
        "Bucket": "media", "Key": "public/teams/test.png", "Body": b"image",
        "ContentType": "image/png",
    }
    assert calls[1][2] == {"Bucket": "media", "Key": "public/teams/test.png"}
    assert storage.public_url("public/teams/test.png") == (
        "http://silo:9000/media/public/teams/test.png"
    )


async def test_wiring_uses_injected_storage_without_closing_it(config, fake_storage):
    class TrackingStorage(type(fake_storage)):
        closed = False

        async def close(self):
            self.closed = True

    storage = TrackingStorage()
    container = build_container(config, telegram=FakeTelegramGateway(), storage=storage)
    try:
        await container.media_service.upload_image(
            "teams", (_FIXTURES / "tiny.png").read_bytes()
        )
        assert len(storage.objects) == 1
        assert container.storage is storage
    finally:
        await container.close()
    assert not storage.closed


async def test_owned_storage_closes_even_when_other_resource_fails():
    calls = []

    class FailingConnector:
        async def close(self):
            calls.append("neo4j")
            raise RuntimeError("synthetic close failure")

    class ClosingResource:
        async def close(self):
            calls.append("resource")

    container = Container(
        views=[], neo4j=FailingConnector(), sqlite=ClosingResource(),
        telegram=ClosingResource(), _owns_telegram=True,
        storage=ClosingResource(), _owns_storage=True,
    )
    with pytest.raises(RuntimeError):
        await container.close()
    assert calls == ["neo4j", "resource", "resource", "resource"]


async def test_api_owns_default_storage_and_bot_stays_storage_free(config, monkeypatch):
    storage_type = feature("eventopia.storage.s3", "S3ObjectStorage")
    closed = []
    original_close = storage_type.close

    async def close(self):
        closed.append(self)
        await original_close(self)

    monkeypatch.setattr(storage_type, "close", close)
    container = build_container(config, telegram=FakeTelegramGateway())
    assert isinstance(container.storage, storage_type)
    await container.close()
    assert closed == [container.storage]

    def unexpected_storage(config):
        pytest.fail("Bot constructed storage", pytrace=False)

    monkeypatch.setattr("eventopia.wiring.S3ObjectStorage", unexpected_storage)
    bot = build_bot_container(config)
    try:
        assert bot.storage is None
        assert bot.media_service is None
    finally:
        await bot.close()


@pytest.fixture
def silo_container(config):
    feature("eventopia.storage.s3", "S3ObjectStorage")
    from testcontainers.core.container import DockerContainer
    from testcontainers.core.wait_strategies import HttpWaitStrategy

    s3 = dict(config["s3"], access_key="test-media-user",
              secret_key="test-media-password-only")
    with (
        DockerContainer("pgsty/silo:RELEASE.2026-10-26T00-00-00Z")
        .with_env("MINIO_ROOT_USER", s3["access_key"])
        .with_env("MINIO_ROOT_PASSWORD", s3["secret_key"])
        .with_env("GOMEMLIMIT", "256MiB")
        .with_exposed_ports(9000)
        .with_command("server /data --console-address :9001")
        .waiting_for(HttpWaitStrategy(9000, "/minio/health/live")) as silo
    ):
        code, _ = silo.exec([
            "/bin/sh", "-ec",
            'mcli alias set local http://localhost:9000 "$MINIO_ROOT_USER" '
            '"$MINIO_ROOT_PASSWORD" >/dev/null; mcli mb local/media >/dev/null; '
            'mcli anonymous set download local/media/public >/dev/null',
        ])
        if code != 0:
            pytest.fail("Disposable Silo initialization failed", pytrace=False)
        s3["endpoint_url"] = (
            f"http://{silo.get_container_host_ip()}:{silo.get_exposed_port(9000)}"
        )
        yield s3


@pytest.mark.integration
async def test_s3_roundtrip_against_silo(silo_container, caplog):
    configure_logging("DEBUG")
    storage = feature("eventopia.storage.s3", "S3ObjectStorage")(silo_container)
    public_key = "public/teams/test-only-storage-private-marker.png"
    private_key = "private/test-only-storage-private-marker.png"
    data = (_FIXTURES / "tiny.png").read_bytes()
    try:
        await storage.put(public_key, data, "image/png")
        await storage.put(private_key, data, "image/png")
        async with httpx.AsyncClient() as client:
            response = await client.get(storage.public_url(public_key))
            assert response.status_code == 200
            assert response.content == data
            assert response.headers["content-type"] == "image/png"
            response = await client.get(storage.public_url(private_key))
            assert response.status_code == 403
            await storage.delete(public_key)
            response = await client.get(storage.public_url(public_key))
            assert response.status_code == 404
        library_logs = "\n".join(
            record.getMessage() for record in caplog.records
            if record.name.startswith(("botocore", "boto3", "s3transfer", "urllib3"))
        )
        logging.getLogger("eventopia.media_test").debug("Application DEBUG preserved")
        assert "Application DEBUG preserved" in caplog.text
        markers = [silo_container["access_key"], silo_container["secret_key"],
                   public_key, private_key]
        if any(marker in library_logs for marker in markers):
            pytest.fail("S3 library logs exposed private details", pytrace=False)
    finally:
        await storage.delete(public_key)
        await storage.delete(private_key)
        await storage.close()
        configure_logging("INFO")
