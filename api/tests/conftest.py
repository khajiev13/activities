from pathlib import Path
from secrets import token_urlsafe

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
async def container(config):
    container = build_container(config)
    try:
        yield container
    finally:
        await container.close()


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


@pytest.fixture(scope="session")
def neo4j_config():
    from testcontainers.community.neo4j import Neo4jContainer

    # Isolated, randomly published port and disposable storage; never the dev DB.
    with (
        Neo4jContainer(
            "neo4j:2026.10.1-community-trixie", password="test-" + token_urlsafe(24)
        )
        .with_env("NEO4J_server_memory_heap_initial__size", "256m")
        .with_env("NEO4J_server_memory_heap_max__size", "256m")
        .with_env("NEO4J_server_memory_pagecache_size", "128m") as database
    ):
        yield {
            "uri": database.get_connection_url(),
            "user": database.username,
            "password": database.password,
            "database": "neo4j",
        }


@pytest.fixture(scope="session")
async def _neo4j_connector(neo4j_config):
    from eventopia.context.neo4j import Neo4jConnector
    from eventopia.schema.apply import apply_constraints

    connector = Neo4jConnector(neo4j_config)
    try:
        await apply_constraints(connector)
        yield connector
    finally:
        await connector.close()


@pytest.fixture
async def neo4j_connector(_neo4j_connector):
    async def clear(tx):
        result = await tx.run("CYPHER 25 MATCH (n) DETACH DELETE n")
        await result.consume()

    await _neo4j_connector.write(clear)
    return _neo4j_connector
