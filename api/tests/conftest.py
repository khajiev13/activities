from pathlib import Path

import httpx
import pytest

from eventopia import create_app
from eventopia.config import load_config
from eventopia.wiring import build_container

API_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture
def config():
    return load_config(str(API_DIR / "config.example.yaml"))


@pytest.fixture
def container(config):
    return build_container(config)


@pytest.fixture
def app(container):
    return create_app(container)


@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        yield client
