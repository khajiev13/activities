import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
from neo4j.exceptions import ConstraintError

from eventopia import create_app
from eventopia.wiring import build_container


async def test_connector_can_ping(neo4j_config):
    from eventopia.context.neo4j import Neo4jConnector

    connector = Neo4jConnector(neo4j_config)
    try:
        assert await connector.ping() is True
    finally:
        await connector.close()


async def test_constraints_apply_twice(neo4j_connector):
    from eventopia.schema.apply import apply_constraints

    await apply_constraints(neo4j_connector)

    async def constraint_properties(tx):
        result = await tx.run(
            "CYPHER 25 SHOW CONSTRAINTS YIELD labelsOrTypes, properties "
            "RETURN labelsOrTypes[0] AS label, properties[0] AS property"
        )
        return {(row["label"], row["property"]) async for row in result}

    assert await neo4j_connector.read(constraint_properties) == {
        ("USER", "uid"),
        ("USER", "username"),
        ("TEAM", "name"),
        ("ACTIVITY", "pk"),
        ("COMPETITION", "pk"),
        ("ORGANIZATION", "pk"),
        ("LOCATION", "pk"),
        ("CATEGORY", "pk"),
        ("CITY", "name"),
        ("STATE", "name"),
        ("COUNTRY", "name"),
        ("COLOR", "name"),
        ("LEAGUE", "name"),
    }


async def test_location_has_point_index(neo4j_connector):
    async def indexes(tx):
        result = await tx.run(
            "CYPHER 25 SHOW POINT INDEXES YIELD labelsOrTypes, properties "
            "RETURN labelsOrTypes AS labels, properties"
        )
        return [row.data() async for row in result]

    assert {"labels": ["LOCATION"], "properties": ["points"]} in (
        await neo4j_connector.read(indexes)
    )


@pytest.mark.parametrize(
    "second", [{"uid": "u1", "username": "b"}, {"uid": "u2", "username": "a"}]
)
async def test_unique_user_keys_enforced(neo4j_connector, second):
    async def create(tx, values):
        result = await tx.run("CYPHER 25 CREATE (:USER $properties)", properties=values)
        await result.consume()

    await neo4j_connector.write(lambda tx: create(tx, {"uid": "u1", "username": "a"}))
    with pytest.raises(ConstraintError):
        await neo4j_connector.write(lambda tx: create(tx, second))


async def test_managed_transactions_commit_and_rollback(neo4j_connector):
    async def create(tx):
        result = await tx.run(
            "CYPHER 25 CREATE (:TEAM {name: $name})", name="Committed"
        )
        await result.consume()
        return "created"

    assert await neo4j_connector.write(create) == "created"

    with pytest.raises(ValueError, match="abort transaction"):
        # Use another label to avoid triggering uniqueness before our rollback.
        async def abort(tx):
            result = await tx.run(
                "CYPHER 25 CREATE (:CITY {name: $name})", name="Aborted"
            )
            await result.consume()
            raise ValueError("abort transaction")

        await neo4j_connector.write(abort)

    async def read(tx):
        result = await tx.run("CYPHER 25 MATCH (t:TEAM) RETURN t { .name } AS team")
        return [row["team"] async for row in result]

    assert await neo4j_connector.read(read) == [{"name": "Committed"}]

    async def cities(tx):
        result = await tx.run("CYPHER 25 MATCH (c:CITY) RETURN count(c) AS total")
        return (await result.single())["total"]

    assert await neo4j_connector.read(cities) == 0


async def test_ready_reports_neo4j(config, neo4j_config):
    config["neo4j"] = neo4j_config
    container = build_container(config)
    app = create_app(container)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "requestId": response.headers["X-Request-ID"],
        "error": 0,
        "data": {"neo4j": True},
    }


async def test_ready_reports_unavailable_dependency(config, neo4j_config, monkeypatch):
    from eventopia.context.neo4j import Neo4jConnector

    monkeypatch.setattr(Neo4jConnector, "ping", AsyncMock(return_value=False))
    config["neo4j"] = neo4j_config
    container = build_container(config)
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(container)),
            base_url="http://test",
        ) as client:
            response = await client.get("/api/health/ready")
        assert response.status_code == 503
        assert response.json()["error"] == 500
        assert response.json()["data"] == {"neo4j": False}
        assert response.json()["requestId"] == response.headers["X-Request-ID"]
    finally:
        await container.close()


async def test_ping_returns_false_on_connection_failure(neo4j_config):
    from eventopia.context.neo4j import Neo4jConnector

    disconnected = {**neo4j_config, "uri": "bolt://127.0.0.1:0"}
    connector = Neo4jConnector(disconnected)
    try:
        assert await connector.ping() is False
    finally:
        await connector.close()


async def test_closed_connector_is_not_ready(neo4j_config):
    from eventopia.context.neo4j import Neo4jConnector

    connector = Neo4jConnector(neo4j_config)
    await connector.close()
    assert await connector.ping() is False


async def test_ready_rejects_nonexistent_configured_database(config, neo4j_config):
    config["neo4j"] = {**neo4j_config, "database": "eventopia-task2-missing"}
    container = build_container(config)
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(container)),
            base_url="http://test",
        ) as client:
            response = await client.get("/api/health/ready")
        assert response.status_code == 503
        assert response.json()["error"] == 500
        assert response.json()["data"] == {"neo4j": False}
    finally:
        await container.close()


async def test_ping_fails_within_health_deadline(neo4j_config):
    from eventopia.context.neo4j import Neo4jConnector

    connections = set()

    async def stall(reader, writer):
        connections.add(writer)
        try:
            await reader.read()
        finally:
            writer.close()
            await writer.wait_closed()
            connections.discard(writer)

    server = await asyncio.start_server(stall, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    connector = Neo4jConnector({**neo4j_config, "uri": f"bolt://127.0.0.1:{port}"})
    try:
        async with asyncio.timeout(8):
            assert await connector.ping() is False
    finally:
        await connector.close()
        server.close()
        await server.wait_closed()
        for writer in tuple(connections):
            writer.close()
            await writer.wait_closed()
