import asyncio
from uuid import UUID

import httpx
import pytest

from eventopia import create_app
from eventopia.models.auth import SharedContact, TelegramUser
from eventopia.storage.fake import FakeObjectStorage
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.wiring import build_container


def check(condition, message):
    if not condition:
        pytest.fail(message, pytrace=False)


@pytest.fixture
async def geo_env(config, sqlite_connector, neo4j_connector, neo4j_config):
    config["sqlite"]["path"] = str(sqlite_connector._engine.url.database)
    config["neo4j"] = neo4j_config
    container = build_container(
        config, telegram=FakeTelegramGateway(), storage=FakeObjectStorage()
    )
    try:
        registered = await container.account_service.register_from_contact(
            TelegramUser(71, "geo_synthetic", "Synthetic"),
            SharedContact(71, "+998901234567"),
            71,
        )
        access = container.session_service.issue_access_token(
            registered.uid, registered.username
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=create_app(container), raise_app_exceptions=False
            ),
            base_url="http://test",
        ) as client:
            yield client, {"Authorization": "Bearer " + access}, neo4j_connector
    finally:
        await container.close()


async def query(connector, statement, **parameters):
    async def work(tx):
        result = await tx.run("CYPHER 25 " + statement, **parameters)
        return await result.data()

    return await connector.write(work)


def payload(response, status=200):
    check(response.status_code == status, "Unexpected endpoint status")
    body = response.json()
    assert set(body) == {"requestId", "error", "data"}
    assert body["error"] == 0
    assert UUID(body["requestId"]).version == 4
    assert response.headers["X-Request-ID"] == body["requestId"]
    return body["data"]


async def seed_categories(graph):
    await query(
        graph,
        "UNWIND $categories AS row CREATE (c:CATEGORY) SET c = row",
        categories=[
            {
                "pk": "indoor",
                "name": "Chess",
                "is_indoor": True,
                "is_outdoor": False,
                "is_online": True,
            },
            {
                "pk": "outdoor",
                "name": "Hiking",
                "is_indoor": False,
                "is_outdoor": True,
                "is_online": False,
            },
            {
                "pk": "both",
                "name": "Fitness",
                "is_indoor": True,
                "is_outdoor": True,
                "is_online": False,
            },
        ],
    )


async def test_countries_empty(geo_env):
    assert payload(await geo_env[0].get("/api/countries/list/")) == []


async def test_countries_nested_skip_missing_and_null_names(geo_env):
    client, _, graph = geo_env
    await query(
        graph,
        "CREATE (c:COUNTRY {name:$country}), (s:STATE {name:$state}), "
        "(city:CITY {name:$city}), (empty:STATE {name:$empty}), "
        "(bare:COUNTRY {name:$bare}), (nullstate:STATE), (nullcity:CITY), "
        "(s)-[:IS_IN]->(c), (city)-[:IS_IN]->(s), "
        "(empty)-[:IS_IN]->(c), (nullstate)-[:IS_IN]->(c), "
        "(nullcity)-[:IS_IN]->(s)",
        country="Country A",
        state="State A",
        city="City A",
        empty="Empty State",
        bare="Country B",
    )
    countries = payload(await client.get("/api/countries/list/"))
    countries.sort(key=lambda row: row["name"])
    countries[0]["states"].sort(key=lambda row: row["name"])
    assert countries == [
        {
            "name": "Country A",
            "states": [
                {"name": "Empty State", "cities": []},
                {"name": "State A", "cities": [{"name": "City A"}]},
            ],
        },
        {"name": "Country B", "states": []},
    ]


async def test_categories_public_list_preserves_flags(geo_env):
    client, _, graph = geo_env
    await seed_categories(graph)
    categories = payload(await client.get("/api/categories/"))
    assert sorted(categories, key=lambda row: row["pk"]) == [
        {
            "pk": "both",
            "name": "Fitness",
            "is_indoor": True,
            "is_outdoor": True,
            "is_online": False,
        },
        {
            "pk": "indoor",
            "name": "Chess",
            "is_indoor": True,
            "is_outdoor": False,
            "is_online": True,
        },
        {
            "pk": "outdoor",
            "name": "Hiking",
            "is_indoor": False,
            "is_outdoor": True,
            "is_online": False,
        },
    ]


@pytest.mark.parametrize(
    "flag,value,expected",
    [
        ("is_indoor", "true", {"indoor", "both"}),
        ("is_indoor", "false", {"outdoor"}),
        ("is_outdoor", "true", {"outdoor", "both"}),
        ("is_outdoor", "false", {"indoor"}),
        ("is_online", "true", {"indoor"}),
        ("is_online", "false", {"outdoor", "both"}),
    ],
)
async def test_category_each_boolean_filter(geo_env, flag, value, expected):
    client, _, graph = geo_env
    await seed_categories(graph)
    categories = payload(await client.get("/api/categories/", params={flag: value}))
    assert {row["pk"] for row in categories} == expected


async def test_category_filters_combine_with_and(geo_env):
    client, _, graph = geo_env
    await seed_categories(graph)
    categories = payload(
        await client.get(
            "/api/categories/",
            params={
                "is_indoor": "true",
                "is_outdoor": "true",
                "is_online": "false",
            },
        )
    )
    assert [row["pk"] for row in categories] == ["both"]


@pytest.mark.parametrize("flag", ["is_indoor", "is_outdoor", "is_online"])
async def test_category_invalid_filter_is_validation_error(geo_env, flag):
    response = await geo_env[0].get("/api/categories/", params={flag: "invalid"})
    check(response.status_code == 422, "Invalid filter must return 422")
    assert response.json()["error"] == 200


async def test_create_category_persists_and_returns_uuid(geo_env):
    client, headers, graph = geo_env
    category = payload(
        await client.post(
            "/api/categories/",
            headers=headers,
            json={
                "name": "Swimming",
                "is_indoor": True,
                "is_outdoor": False,
                "is_online": False,
            },
        ),
        201,
    )
    assert UUID(category.pop("pk")).version == 4
    assert category == {
        "name": "Swimming",
        "is_indoor": True,
        "is_outdoor": False,
        "is_online": False,
    }
    rows = await query(
        graph,
        "MATCH (c:CATEGORY) RETURN c { .name, .is_indoor, "
        ".is_outdoor, .is_online } AS category",
    )
    assert rows == [{"category": category}]


@pytest.mark.parametrize("existing_name", ["CHESS", "Chess"])
async def test_duplicate_category_name_case_insensitive_including_legacy(
    geo_env, existing_name
):
    client, headers, graph = geo_env
    await query(
        graph,
        "CREATE (:CATEGORY {pk:$pk, name:$name, "
        "is_indoor:true, is_outdoor:false, is_online:true})",
        pk="existing",
        name=existing_name,
    )
    response = await client.post(
        "/api/categories/",
        headers=headers,
        json={
            "name": "chess",
            "is_indoor": False,
            "is_outdoor": True,
            "is_online": False,
        },
    )
    check(response.status_code == 409, "Case-insensitive duplicate must return 409")
    assert response.json()["error"] == 400
    rows = await query(
        graph,
        "MATCH (c:CATEGORY) RETURN c { .pk, .name, "
        ".is_indoor, .is_outdoor, .is_online } AS category",
    )
    assert rows == [
        {
            "category": {
                "pk": "existing",
                "name": existing_name,
                "is_indoor": True,
                "is_outdoor": False,
                "is_online": True,
            }
        }
    ]


async def test_concurrent_category_duplicate_is_conflict(geo_env):
    client, headers, graph = geo_env
    responses = await asyncio.gather(
        *[
            client.post(
                "/api/categories/",
                headers=headers,
                json={
                    "name": name,
                    "is_indoor": False,
                    "is_outdoor": True,
                    "is_online": False,
                },
            )
            for name in ("Racing", "RACING")
        ]
    )
    check(
        sorted(r.status_code for r in responses) == [201, 409],
        "Concurrent duplicate must yield one creation and one conflict",
    )
    rows = await query(graph, "MATCH (c:CATEGORY) RETURN count(c) AS total")
    assert rows == [{"total": 1}]


@pytest.mark.parametrize(
    "path,body",
    [
        (
            "/api/categories/",
            {
                "name": "Chess",
                "is_indoor": True,
                "is_outdoor": False,
                "is_online": True,
            },
        ),
        (
            "/api/locations/",
            {
                "name": "Park",
                "latitude": 41.3,
                "longitude": 69.2,
                "country": "Country",
                "state": "State",
                "city": "City",
            },
        ),
    ],
)
async def test_writes_require_token_and_do_not_write(geo_env, path, body):
    client, _, graph = geo_env
    response = await client.post(path, json=body)
    check(response.status_code == 401, "Write without token must return 401")
    assert response.json()["error"] == 101
    rows = await query(
        graph,
        "MATCH (n) WHERE n:CATEGORY OR n:LOCATION "
        "OR n:CITY OR n:STATE OR n:COUNTRY RETURN count(n) AS total",
    )
    assert rows == [{"total": 0}]


@pytest.mark.parametrize(
    "coordinates",
    [
        {"latitude": 41.3, "longitude": 69.2},
        {"points": {"latitude": 41.3, "longitude": 69.2}},
    ],
)
async def test_create_location_coordinates_and_real_wgs84_hierarchy(
    geo_env, coordinates
):
    client, headers, graph = geo_env
    location = payload(
        await client.post(
            "/api/locations/",
            headers=headers,
            json={
                "name": "Synthetic Park",
                "country": "Country",
                "state": "State",
                "city": "City",
                **coordinates,
            },
        ),
        201,
    )
    assert UUID(location["pk"]).version == 4
    assert location == {
        "pk": location["pk"],
        "name": "Synthetic Park",
        "points": {"latitude": 41.3, "longitude": 69.2},
    }
    rows = await query(
        graph,
        "MATCH (l:LOCATION {pk:$pk})-[:IS_IN]->(city:CITY)"
        "-[:IS_IN]->(state:STATE)-[:IS_IN]->(country:COUNTRY) "
        "RETURN l { .name, srid:l.points.srid, latitude:l.points.latitude, "
        "longitude:l.points.longitude } AS location, "
        "city {.name} AS city, state {.name} AS state, country {.name} AS country",
        pk=location["pk"],
    )
    assert rows == [
        {
            "location": {
                "name": "Synthetic Park",
                "srid": 4326,
                "latitude": 41.3,
                "longitude": 69.2,
            },
            "city": {"name": "City"},
            "state": {"name": "State"},
            "country": {"name": "Country"},
        }
    ]


async def test_location_reuses_existing_hierarchy_and_creates_new_location(geo_env):
    client, headers, graph = geo_env
    await query(
        graph,
        "CREATE (c:COUNTRY {name:$country}), "
        "(s:STATE {name:$state})-[:IS_IN]->(c), "
        "(city:CITY {name:$city})-[:IS_IN]->(s)",
        country="Country",
        state="State",
        city="City",
    )
    pks = []
    for name in ("Park", "Pool"):
        location = payload(
            await client.post(
                "/api/locations/",
                headers=headers,
                json={
                    "name": name,
                    "latitude": 41.3,
                    "longitude": 69.2,
                    "country": "Country",
                    "state": "State",
                    "city": "City",
                },
            ),
            201,
        )
        pks.append(location["pk"])
    assert len(set(pks)) == 2
    rows = await query(
        graph,
        "MATCH (n) WHERE n:LOCATION OR n:CITY OR n:STATE "
        "OR n:COUNTRY RETURN labels(n)[0] AS label, count(n) AS total "
        "ORDER BY label",
    )
    assert rows == [
        {"label": "CITY", "total": 1},
        {"label": "COUNTRY", "total": 1},
        {"label": "LOCATION", "total": 2},
        {"label": "STATE", "total": 1},
    ]
    assert payload(await client.get("/api/countries/list/")) == [
        {"name": "Country", "states": [{"name": "State", "cities": [{"name": "City"}]}]}
    ]


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/countries/list"),
        ("GET", "/api/categories"),
        ("POST", "/api/locations"),
    ],
)
async def test_geo_routes_wrong_slash_do_not_redirect(geo_env, method, path):
    response = await geo_env[0].request(method, path)
    check(response.status_code == 404, "Wrong trailing slash must return 404")
    assert response.json()["error"] == 300
    assert "location" not in response.headers
