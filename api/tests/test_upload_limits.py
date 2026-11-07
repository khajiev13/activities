from types import SimpleNamespace

import httpx
import pytest
from starlette.datastructures import UploadFile

from eventopia import create_app
from eventopia.storage.fake import FakeObjectStorage
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.wiring import build_container


@pytest.mark.parametrize("kind", ["teams", "organizations"])
@pytest.mark.parametrize("size", [64, 65, 10000])
async def test_upload_view_bounds_read_before_service_validation(
    config, monkeypatch, kind, size
):
    config["s3"]["max_upload_bytes"] = 64
    storage = FakeObjectStorage()
    container = build_container(config, telegram=FakeTelegramGateway(), storage=storage)
    reads = []
    original_read = UploadFile.read

    async def read(self, size=-1):
        reads.append(size)
        return await original_read(self, size)

    async def authenticate(_):
        return SimpleNamespace(uid="synthetic-user")

    async def write(*args, **kwargs):
        assert size == 64, "Oversized upload reached graph storage"
        return SimpleNamespace(
            name="Synthetic upload",
            pk="synthetic",
            model_dump=lambda: {"name": "Synthetic upload"},
        )

    monkeypatch.setattr(UploadFile, "read", read)
    monkeypatch.setattr(container.auth_service, "authenticate", authenticate)
    monkeypatch.setattr(container.neo4j, "write", write)
    form = dict(
        name="Synthetic upload",
        country="Country",
        state="State",
        city="City",
        pk_for_location="park",
    )
    if kind == "teams":
        form = dict(
            name="Synthetic upload",
            men_team="true",
            public_team="true",
            country_name="Country",
            state_name="State",
            city_name="City",
            location="park",
            categories="[]",
        )
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(container)),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/" + kind + "/",
                data=form,
                files={
                    "image": (
                        "image.png",
                        b"\x89PNG\r\n\x1a\n" + b"x" * (size - 8),
                        "image/png",
                    )
                },
            )
        assert response.status_code == (201 if size == 64 else 422)
        assert response.json()["error"] == (0 if size == 64 else 201)
        assert len(storage.objects) == (1 if size == 64 else 0)
        assert reads == [65], "HTTP upload must read only the configured limit plus one"
    finally:
        await container.close()
