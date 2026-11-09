import asyncio
from datetime import datetime
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


async def query(graph, statement, **parameters):
    async def work(tx):
        result = await tx.run("CYPHER 25 " + statement, **parameters)
        return await result.data()

    return await graph.write(work)


def payload(response, status=200):
    check(response.status_code == status, f"Expected HTTP {status}")
    body = response.json()
    assert set(body) == {"requestId", "error", "data"}
    assert body["error"] == 0
    assert UUID(body["requestId"]).version == 4
    assert response.headers["X-Request-ID"] == body["requestId"]
    return body["data"]


@pytest.fixture
async def activity_env(config, sqlite_connector, neo4j_connector, neo4j_config):
    config["sqlite"]["path"] = str(sqlite_connector._engine.url.database)
    config["neo4j"] = neo4j_config
    container = build_container(
        config, telegram=FakeTelegramGateway(), storage=FakeObjectStorage()
    )
    try:
        headers = []
        for index, name in enumerate(("creator_a", "joiner_b", "joiner_c"), 1):
            registered = await container.account_service.register_from_contact(
                TelegramUser(index, name, name),
                SharedContact(index, f"+99890123456{index}"),
                index,
            )
            access = container.session_service.issue_access_token(
                registered.uid, registered.username
            )
            headers.append({"Authorization": "Bearer " + access})
        await query(
            neo4j_connector,
            "CREATE (country:COUNTRY {name:$country}), "
            "(state:STATE {name:$state})-[:IS_IN]->(country), "
            "(city:CITY {name:$city})-[:IS_IN]->(state), "
            "(:LOCATION {pk:$pk, name:$name, "
            "points:point({latitude:$latitude, longitude:$longitude})})"
            "-[:IS_IN]->(city)",
            country="Country",
            state="State",
            city="City",
            pk="park",
            name="Synthetic Park",
            latitude=41.3,
            longitude=69.2,
        )
        await query(
            neo4j_connector,
            "UNWIND $names AS name CREATE (:CATEGORY "
            "{pk:toLower(name), name:name, name_key:toLower(name)})",
            names=["Chess", "Hiking", "Fitness"],
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=create_app(container), raise_app_exceptions=False
            ),
            base_url="http://test",
        ) as client:
            yield client, headers, neo4j_connector
    finally:
        await container.close()


def body(**updates):
    return {
        "title": "Evening Hiking",
        "description": "Synthetic activity description",
        "public": True,
        "date_time": "2026-11-20T18:00:00.123Z",
        "duration_in_minutes": 90,
        "location": {"pk": "park"},
        "country": {"name": "Country"},
        "state": {"name": "State"},
        "city": {"name": "City"},
        "categories": [
            {"pk": name.lower(), "name": name}
            for name in ("Chess", "Hiking", "Fitness")
        ],
        "is_competition": False,
        "sunrise_time_for_chosen_location": None,
        "name_for_location": "Synthetic Park",
        **updates,
    }


async def create(env, **updates):
    client, headers, _ = env
    return payload(
        await client.post("/api/activities/", headers=headers[0], json=body(**updates)),
        201,
    )


async def test_create_full_contract_new_telegram_profile_and_graph(activity_env):
    activity = await create(activity_env, creator={"username": "joiner_b"})
    assert set(activity) == {
        "categories",
        "city",
        "competition",
        "country",
        "creator",
        "date_time",
        "description",
        "duration_in_minutes",
        "location",
        "number_of_people_joined",
        "people_joined",
        "pk",
        "public",
        "state",
        "title",
    }
    assert UUID(activity["pk"]).version == 4
    assert activity["creator"] == {
        "first_name": "creator_a",
        "last_name": "",
        "image_url": "",
        "username": "creator_a",
    }
    assert activity["location"] == {
        "pk": "park",
        "name": "Synthetic Park",
        "points": {"latitude": 41.3, "longitude": 69.2},
    }
    assert activity["categories"] == [
        {"name": "Chess", "pk": "chess"},
        {"name": "Fitness", "pk": "fitness"},
        {"name": "Hiking", "pk": "hiking"},
    ]
    assert activity["people_joined"] == []
    assert activity["number_of_people_joined"] == 0
    assert activity["duration_in_minutes"] == 90
    assert activity["public"] is True
    assert activity["country"] == {"name": "Country"}
    assert activity["state"] == {"name": "State"}
    assert activity["city"] == {"name": "City"}
    assert activity["description"] == body()["description"]
    assert activity["title"] == body()["title"]
    assert (
        payload(await activity_env[0].get("/api/activities/" + activity["pk"]))
        == activity
    )
    rows = await query(
        activity_env[2],
        "MATCH (creator:USER)-[:CREATES]->(a:ACTIVITY {pk:$pk}) "
        "RETURN creator {.username, .last_name, .image_url} AS creator, "
        "COLLECT { MATCH (a)-[r]->() RETURN DISTINCT type(r) AS kind "
        "ORDER BY kind } AS relationships, "
        "a.duration_in_minutes AS duration, toString(a.date_time) AS date_time",
        pk=activity["pk"],
    )
    assert rows == [
        {
            "creator": {"username": "creator_a", "last_name": None, "image_url": None},
            "relationships": [
                "CITY_BASED_IN",
                "COUNTRY_BASED_IN",
                "HAPPENS_AT",
                "IS_TYPE_OF",
                "STATE_BASED_IN",
            ],
            "duration": 90,
            "date_time": activity["date_time"],
        }
    ]


async def test_people_joined_lists_joiners_not_creator(activity_env):
    activity = await create(activity_env)
    client, headers, _ = activity_env
    for joiner in headers[1:]:
        updated = payload(
            await client.post(f"/api/activities/{activity['pk']}/join/", headers=joiner)
        )
    assert {person["username"] for person in updated["people_joined"]} == {
        "joiner_b",
        "joiner_c",
    }
    assert all(
        set(p) == {"first_name", "last_name", "username", "image_url"}
        for p in updated["people_joined"]
    )
    assert all(p["last_name"] is None for p in updated["people_joined"])


async def test_count_not_inflated_by_categories(activity_env):
    activity = await create(activity_env)
    client, headers, graph = activity_env
    for joiner in headers[1:]:
        payload(
            await client.post(f"/api/activities/{activity['pk']}/join/", headers=joiner)
        )
    # Even duplicate legacy edges must not inflate the projection.
    await query(
        graph,
        "MATCH (u:USER {username:$username}), (a:ACTIVITY {pk:$pk}), "
        "(c:CATEGORY {pk:$category}) CREATE (u)-[:JOINS]->(a), "
        "(a)-[:IS_TYPE_OF]->(c)",
        username="joiner_b",
        pk=activity["pk"],
        category="chess",
    )
    for path in (
        f"/api/activities/{activity['pk']}",
        "/api/activities/country/Country/",
        "/api/activities/state/State/",
        "/api/activities/city/City/",
    ):
        result = payload(await client.get(path))
        result = result[0] if isinstance(result, list) else result
        assert result["number_of_people_joined"] == 2
        assert len(result["people_joined"]) == 2
        assert len(result["categories"]) == 3


async def test_non_competition_has_null_competition_names(activity_env):
    activity = await create(activity_env)
    assert activity["competition"] == {
        "team_1": {"name": None, "image_url": None},
        "team_2": {"name": None, "image_url": None},
    }


async def test_competition_roundtrip(activity_env):
    await query(
        activity_env[2],
        "CREATE (:TEAM {name:$name, image_url:$image})",
        name="Beijing 炎龙",
        image="https://example.test/team.png",
    )
    activity = await create(
        activity_env,
        is_competition=True,
        competition={
            "team_1": {"name": "Beijing 炎龙"},
            "team_2": {"name": "Añejo FC 7s"},
        },
    )
    assert activity["competition"] == {
        "team_1": {
            "name": "Beijing 炎龙",
            "image_url": "https://example.test/team.png",
        },
        "team_2": {"name": "Añejo FC 7s", "image_url": None},
    }
    rows = await query(
        activity_env[2],
        "MATCH (a:ACTIVITY {pk:$pk})-[:IS_COMPETITION]->(c:COMPETITION) "
        "MATCH (c)-[:TEAM_1]->(one:TEAM), (c)-[:TEAM_2]->(two:TEAM) "
        "RETURN c {.pk} AS competition, one {.name} AS one, two {.name} AS two",
        pk=activity["pk"],
    )
    assert UUID(rows[0]["competition"]["pk"]).version == 4
    assert rows[0]["one"] == {"name": "Beijing 炎龙"}
    assert rows[0]["two"] == {"name": "Añejo FC 7s"}


@pytest.mark.parametrize(
    "date_time",
    [
        "2026-11-20T18:00:00Z",
        "2026-11-20T18:00:00.123Z",
        "2026-11-20T23:00:00+05:00",
        "2026-11-20T23:00:00.123+05:00",
    ],
)
async def test_date_time_without_millis_accepted(activity_env, date_time):
    activity = await create(activity_env, date_time=date_time)
    assert datetime.fromisoformat(activity["date_time"]) == datetime.fromisoformat(
        date_time
    )


@pytest.mark.parametrize(
    "level,csv,params,expected",
    [
        ("country", " Missing, Country ", {}, True),
        ("country", "Missing", {}, False),
        ("state", "State", {"countries[]": "Country"}, True),
        ("state", "State", {"countries[]": "Wrong"}, False),
        ("city", "City", {"countries[]": "Country", "states[]": "State"}, True),
        ("city", "City", {"countries[]": "Wrong"}, False),
        ("city", "City", {"states[]": "Wrong"}, False),
        ("city", "City", {"countries[]": ["Wrong", "Country"]}, True),
        ("city", "City", {"search_by": "NING hiK"}, True),
        ("country", "Country", {"search_by": "unrelated"}, False),
    ],
)
async def test_search_city_with_countries_filter(
    activity_env, level, csv, params, expected
):
    activity = await create(activity_env)
    results = payload(
        await activity_env[0].get(f"/api/activities/{level}/{csv}/", params=params)
    )
    assert results == ([activity] if expected else [])


async def test_join_leave_idempotent_and_requires_auth(activity_env):
    activity = await create(activity_env)
    client, headers, graph = activity_env
    base = f"/api/activities/{activity['pk']}"
    for action in ("join", "leave"):
        response = await client.post(f"{base}/{action}/")
        check(response.status_code == 401, "Membership requires authentication")
        assert response.json()["error"] == 101
    for action, expected in (("join", 1), ("join", 1), ("leave", 0), ("leave", 0)):
        updated = payload(await client.post(f"{base}/{action}/", headers=headers[1]))
        assert updated["number_of_people_joined"] == expected
    responses = await asyncio.gather(
        *[client.post(f"{base}/join/", headers=headers[1]) for _ in range(2)]
    )
    assert all(payload(r)["number_of_people_joined"] == 1 for r in responses)
    assert await query(
        graph,
        "MATCH (:USER)-[r:JOINS]->(:ACTIVITY {pk:$pk}) RETURN count(r) AS total",
        pk=activity["pk"],
    ) == [{"total": 1}]


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/activities/missing"),
        ("POST", "/api/activities/missing/join/"),
        ("POST", "/api/activities/missing/leave/"),
        ("GET", "/api/activities/missing/"),
        ("GET", "/api/activities/city/City"),
        ("POST", "/api/activities"),
    ],
)
async def test_missing_and_wrong_slash_routes(activity_env, method, path):
    response = await activity_env[0].request(method, path, headers=activity_env[1][0])
    check(response.status_code == 404, "Missing/wrong slash must return 404")
    assert response.json()["error"] == 300
    assert "location" not in response.headers


async def test_create_requires_auth_without_writing(activity_env):
    response = await activity_env[0].post("/api/activities/", json=body())
    check(response.status_code == 401, "Create requires authentication")
    assert response.json()["error"] == 101
    assert await query(
        activity_env[2], "MATCH (a:ACTIVITY) RETURN count(a) AS total"
    ) == [{"total": 0}]


@pytest.mark.parametrize(
    "updates",
    [
        {"date_time": "bad"},
        {"is_competition": True},
        {"location": {"pk": "missing"}},
        {"country": {"name": "Wrong"}},
        {"categories": [{"pk": "missing", "name": "Missing"}]},
    ],
)
async def test_invalid_create_does_not_leave_partial_graph(activity_env, updates):
    response = await activity_env[0].post(
        "/api/activities/", headers=activity_env[1][0], json=body(**updates)
    )
    check(response.status_code == 422, "Invalid activity must return 422")
    assert response.json()["error"] in (200, 201)
    assert await query(
        activity_env[2],
        "MATCH (n) WHERE n:ACTIVITY OR n:COMPETITION RETURN count(n) AS total",
    ) == [{"total": 0}]
