import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

import httpx
import pytest

from eventopia import create_app
from eventopia.models.auth import SharedContact, TelegramUser
from eventopia.storage.fake import FakeObjectStorage
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.wiring import build_container


async def query(graph, statement, **parameters):
    async def work(tx):
        result = await tx.run("CYPHER 25 " + statement, **parameters)
        return await result.data()

    return await graph.write(work)


def payload(response, status=200):
    if response.status_code != status:
        pytest.fail(
            f"Expected HTTP {status}, got {response.status_code}", pytrace=False
        )
    body = response.json()
    assert set(body) == {"requestId", "error", "data"}
    assert body["error"] == 0
    assert UUID(body["requestId"]).version == 4
    assert response.headers["X-Request-ID"] == body["requestId"]
    return body["data"]


def error(response, status, code):
    assert response.status_code == status
    body = response.json()
    assert {"requestId", "error", "message"} <= body.keys()
    assert body["error"] == code
    assert UUID(body["requestId"]).version == 4
    assert body["requestId"] == response.headers["X-Request-ID"]


@pytest.fixture
async def team_env(config, sqlite_connector, neo4j_connector, neo4j_config):
    config["sqlite"]["path"] = str(sqlite_connector._engine.url.database)
    config["neo4j"] = neo4j_config
    storage = FakeObjectStorage()
    container = build_container(config, telegram=FakeTelegramGateway(), storage=storage)
    try:
        headers = []
        for index, name in enumerate(("owner_a", "player_b", "player_c"), 1):
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
            "{pk:toLower(name), name:name, name_key:toLower(name), "
            "is_indoor:false, is_outdoor:true, is_online:false})",
            names=["Football", "Fitness"],
        )
        await query(
            neo4j_connector,
            "UNWIND $orgs AS org CREATE (:ORGANIZATION {pk:org.pk, name:org.name})",
            orgs=[
                {"pk": "org-owner", "name": "Synthetic Club"},
                {"pk": "org-sponsor", "name": "Synthetic Sponsor"},
            ],
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=create_app(container), raise_app_exceptions=False
            ),
            base_url="http://test",
        ) as client:
            yield client, headers, neo4j_connector, storage
    finally:
        await container.close()


def form(**updates):
    return {
        "name": "Synthetic FC",
        "men_team": "true",
        "public_team": "false",
        "country_name": "Country",
        "state_name": "State",
        "city_name": "City",
        "location": "park",
        "categories": json.dumps(
            [
                {"pk": "football", "name": "Football"},
                {"pk": "fitness", "name": "Fitness"},
            ]
        ),
        "sponsors": json.dumps(["org-sponsor"]),
        "belongs_to_organization": "org-owner",
        "founded_at": "2020-01-02T00:00:00Z",
        "tshirt_color": "Red",
        "shorts_color": "Blue",
        "socks_color": "White",
        "away_tshirt_color": "Black",
        **updates,
    }


async def create(env, **updates):
    return payload(
        await env[0].post("/api/teams/", headers=env[1][0], data=form(**updates)), 201
    )


def join_body(**updates):
    return {
        "name_on_jersey": "ALI",
        "player_number": 77,
        "position": "Forward",
        **updates,
    }


LIST_KEYS = {
    "away_tshirt_color",
    "categories",
    "city_name",
    "country_name",
    "founded_at",
    "image_url",
    "location",
    "men_team",
    "name",
    "public_team",
    "shorts_color",
    "socks_color",
    "state_name",
    "tshirt_color",
}
MEMBER_KEYS = {
    "username",
    "first_name",
    "last_name",
    "image_url",
    "name_on_jersey",
    "role",
    "plays_for_division",
    "player_number",
}


async def test_create_full_contract_and_graph_ownership(team_env):
    team = await create(team_env, creator="player_b")
    assert LIST_KEYS <= team.keys()
    assert team["name"] == "Synthetic FC"
    assert team["men_team"] is True and team["public_team"] is False
    assert team["image_url"] is None
    assert datetime.fromisoformat(team["founded_at"]) == datetime.fromisoformat(
        "2020-01-02T00:00:00Z"
    )
    assert team["location"] == [
        {
            "pk": "park",
            "name": "Synthetic Park",
            "points": {"latitude": 41.3, "longitude": 69.2},
        }
    ]
    assert team["country_name"] == "Country"
    assert team["state_name"] == "State" and team["city_name"] == "City"
    for key, name in [
        ("tshirt_color", "Red"),
        ("shorts_color", "Blue"),
        ("socks_color", "White"),
        ("away_tshirt_color", "Black"),
    ]:
        assert team[key] == [{"name": name}]
    detail = payload(await team_env[0].get("/api/teams/Synthetic%20FC/"))
    assert set(detail) == LIST_KEYS | {"members", "sponsors", "belongs_to_organization"}
    assert detail["members"] == []
    assert detail["sponsors"] == [{"name": "Synthetic Sponsor"}]
    assert detail["belongs_to_organization"] == [{"name": "Synthetic Club"}]
    assert len(detail["categories"]) == 2
    assert set(detail["categories"][0]) == {
        "pk",
        "name",
        "is_indoor",
        "is_outdoor",
        "is_online",
    }
    assert await query(
        team_env[2],
        "MATCH (u:USER)-[:CREATES]->(t:TEAM {name:$name}) "
        "MATCH (:ORGANIZATION {pk:$org})-[:HAS_TEAM]->(t) "
        "MATCH (:ORGANIZATION {pk:$sponsor})-[r:SPONSORS]->(t) "
        "MATCH (t)-[:BASED_IN]->(:LOCATION {pk:$location}) "
        "MATCH (t)-[:CITY_BASED_IN]->(:CITY {name:$city}) "
        "MATCH (t)-[:STATE_BASED_IN]->(:STATE {name:$state}) "
        "MATCH (t)-[:COUNTRY_BASED_IN]->(:COUNTRY {name:$country}) "
        "RETURN u.username AS owner, toString(r.since) AS since",
        name="Synthetic FC",
        org="org-owner",
        sponsor="org-sponsor",
        location="park",
        city="City",
        state="State",
        country="Country",
    ) == [{"owner": "owner_a", "since": datetime.now(UTC).date().isoformat()}]


async def test_create_without_image_founded_date_colors_or_organization(team_env):
    data = form()
    for key in (
        "founded_at",
        "tshirt_color",
        "shorts_color",
        "socks_color",
        "away_tshirt_color",
        "belongs_to_organization",
        "sponsors",
    ):
        data.pop(key)
    team = payload(
        await team_env[0].post("/api/teams/", headers=team_env[1][0], data=data), 201
    )
    assert team["image_url"] is None and team["founded_at"] is None
    detail = payload(await team_env[0].get("/api/teams/Synthetic%20FC/"))
    for key in (
        "tshirt_color",
        "shorts_color",
        "socks_color",
        "away_tshirt_color",
        "sponsors",
        "belongs_to_organization",
    ):
        assert detail[key] == []
    assert len(payload(await team_env[0].get("/api/teams/search/synthetic/"))) == 1
    joined = payload(
        await team_env[0].post(
            "/api/teams/Synthetic%20FC/join/", headers=team_env[1][1], json=join_body()
        )
    )
    assert joined["members"][0]["role"] == "Forward"
    assert joined["founded_at"] is None and joined["image_url"] is None


async def test_create_with_image_returns_absolute_url(team_env):
    image = (Path(__file__).parent / "fixtures/tiny.png").read_bytes()
    team = payload(
        await team_env[0].post(
            "/api/teams/",
            headers=team_env[1][0],
            data=form(),
            files={"image": ("team.png", image, "image/png")},
        ),
        201,
    )
    assert team["image_url"].startswith("http://localhost:5173/media/public/teams/")
    assert list(team_env[3].objects.values()) == [(image, "image/png")]
    assert (
        payload(await team_env[0].get("/api/teams/Synthetic%20FC/"))["image_url"]
        == (team["image_url"])
    )


async def test_duplicate_write_compensates_uploaded_image(team_env, monkeypatch):
    await create(team_env)
    uploaded = []
    storage = team_env[3]
    original_put = storage.put

    async def put(key, data, content_type):
        # This boundary must execute before the graph rejects the duplicate name.
        assert await query(team_env[2], "MATCH (t:TEAM) RETURN count(t) AS n") == [
            {"n": 1}
        ]
        await original_put(key, data, content_type)
        uploaded.append(key)

    monkeypatch.setattr(storage, "put", put)
    image = (Path(__file__).parent / "fixtures/tiny.png").read_bytes()
    response = await team_env[0].post(
        "/api/teams/",
        headers=team_env[1][0],
        data=form(),
        files={"image": ("team.png", image, "image/png")},
    )
    error(response, 409, 400)
    assert len(uploaded) == 1 and storage.objects == {}
    assert await query(team_env[2], "MATCH (t:TEAM) RETURN count(t) AS n") == [{"n": 1}]


@pytest.mark.parametrize("name", ["Beijing 炎龙", "Shuòguǒ 硕果 FC", "Añejo FC 7s"])
async def test_unicode_team_names_resolve(team_env, name):
    await create(team_env, name=name)
    path = f"/api/teams/{quote(name)}/"
    assert payload(await team_env[0].get(path))["name"] == name
    joined = payload(
        await team_env[0].post(path + "join/", headers=team_env[1][1], json=join_body())
    )
    assert joined["members"][0]["player_number"] == 77


async def test_join_conflicts_and_member_payload_has_no_pii(team_env):
    await create(team_env)
    client, headers, graph, _ = team_env
    path = "/api/teams/Synthetic%20FC/join/"
    joined = payload(await client.post(path, headers=headers[1], json=join_body()))
    member = joined["members"][0]
    assert set(member) == MEMBER_KEYS
    assert member == {
        "username": "player_b",
        "first_name": "player_b",
        "last_name": "",
        "image_url": None,
        "name_on_jersey": "ALI",
        "role": "Forward",
        "plays_for_division": None,
        "player_number": 77,
    }
    error(
        await client.post(path, headers=headers[1], json=join_body(player_number=88)),
        409,
        400,
    )
    error(await client.post(path, headers=headers[2], json=join_body()), 409, 400)
    payload(
        await client.post(path, headers=headers[2], json=join_body(player_number=88))
    )
    assert await query(
        graph, "MATCH (:USER)-[r:IS_MEMBER_OF]->(:TEAM) RETURN count(r) AS n"
    ) == [{"n": 2}]
    await create(team_env, name="Other FC")
    payload(
        await client.post(
            "/api/teams/Other%20FC/join/", headers=headers[1], json=join_body()
        )
    )


@pytest.mark.parametrize("same_user", [False, True])
async def test_concurrent_joins_are_atomic(team_env, same_user):
    await create(team_env)
    responses = await asyncio.gather(
        *[
            team_env[0].post(
                "/api/teams/Synthetic%20FC/join/",
                headers=team_env[1][1 if same_user else index],
                json=join_body(player_number=77 if not same_user else index),
            )
            for index in (1, 2)
        ]
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    assert await query(
        team_env[2], "MATCH (:USER)-[r:IS_MEMBER_OF]->(:TEAM) RETURN count(r) AS n"
    ) == [{"n": 1}]


@pytest.mark.parametrize(
    "position", ["Goalkeeper", "Defender", "Midfielder", "Forward"]
)
async def test_four_positions_round_trip(team_env, position):
    await create(team_env)
    team = payload(
        await team_env[0].post(
            "/api/teams/Synthetic%20FC/join/",
            headers=team_env[1][1],
            json=join_body(position=position),
        )
    )
    assert team["members"][0]["role"] == position


@pytest.mark.parametrize(
    "updates",
    [{"position": "Striker"}, {"player_number": 1.5}, {"player_number": "wrong"}],
)
async def test_invalid_membership_request(team_env, updates):
    await create(team_env)
    error(
        await team_env[0].post(
            "/api/teams/Synthetic%20FC/join/",
            headers=team_env[1][1],
            json=join_body(**updates),
        ),
        422,
        200,
    )


@pytest.mark.parametrize(
    "level,csv,params,expected",
    [
        ("country", " Missing, Country ", {}, True),
        ("country", "Wrong", {}, False),
        ("state", "State", {"countries[]": "Country"}, True),
        ("state", "State", {"countries[]": "Wrong"}, False),
        ("city", "City", {"countries[]": "Country", "states[]": "State"}, True),
        ("city", "City", {"countries[]": "Wrong"}, False),
        ("city", "City", {"states[]": "Wrong"}, False),
        ("city", "City", {"countries[]": ["Wrong", "Country"]}, True),
        ("city", "City", {"search_by": "TheTic f"}, True),
        ("country", "Country", {"search_by": "unrelated"}, False),
    ],
)
async def test_geo_search_contract_and_filters(team_env, level, csv, params, expected):
    await create(team_env)
    teams = payload(await team_env[0].get(f"/api/teams/{level}/{csv}/", params=params))
    assert len(teams) == int(expected)
    if expected:
        assert set(teams[0]) == LIST_KEYS


async def test_search_arrays_have_no_duplicates(team_env):
    await create(team_env)
    for index in range(3):
        payload(
            await team_env[0].post(
                "/api/teams/Synthetic%20FC/join/",
                headers=team_env[1][index],
                json=join_body(player_number=index),
            )
        )
    await query(
        team_env[2],
        "MATCH (t:TEAM {name:$name})-[r]->(n) "
        "WHERE type(r) IN $types "
        "FOREACH (_ IN CASE type(r) WHEN 'IS_TYPE_OF' THEN [1] ELSE [] END | "
        "CREATE (t)-[:IS_TYPE_OF]->(n)) "
        "FOREACH (_ IN CASE type(r) WHEN 'TSHIRT_COLOR' THEN [1] ELSE [] END | "
        "CREATE (t)-[:TSHIRT_COLOR]->(n))",
        name="Synthetic FC",
        types=["IS_TYPE_OF", "TSHIRT_COLOR"],
    )
    teams = payload(await team_env[0].get("/api/teams/search/THETIC/"))
    assert len(teams) == 1 and set(teams[0]) == LIST_KEYS
    detail = payload(await team_env[0].get("/api/teams/Synthetic%20FC/"))
    assert len(detail["members"]) == 3 and len(detail["categories"]) == 2
    for team in [teams[0], detail]:
        for key in ("tshirt_color", "shorts_color", "socks_color", "away_tshirt_color"):
            assert len(team[key]) == 1
        assert len(team["location"]) == 1
    assert payload(await team_env[0].get("/api/teams/search/Missing/")) == []


async def test_create_and_join_require_auth(team_env):
    error(await team_env[0].post("/api/teams/", data=form()), 401, 101)
    error(
        await team_env[0].post("/api/teams/missing/join/", json=join_body()), 401, 101
    )
    assert await query(team_env[2], "MATCH (t:TEAM) RETURN count(t) AS n") == [{"n": 0}]


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/teams/missing/"),
        ("POST", "/api/teams/missing/join/"),
        ("GET", "/api/teams/Synthetic%20FC"),
        ("POST", "/api/teams"),
        ("GET", "/api/teams/city/City"),
    ],
)
async def test_missing_and_wrong_slash_routes(team_env, method, path):
    response = await team_env[0].request(
        method, path, headers=team_env[1][0], json=join_body()
    )
    error(response, 404, 300)
    assert "location" not in response.headers


@pytest.mark.parametrize(
    "updates",
    [
        {"location": "missing"},
        {"city_name": "Wrong"},
        {"categories": '[{"pk":"missing","name":"Missing"}]'},
        {"belongs_to_organization": "missing"},
        {"sponsors": '["missing"]'},
    ],
)
async def test_unknown_references_do_not_write_partial_graph(team_env, updates):
    response = await team_env[0].post(
        "/api/teams/", headers=team_env[1][0], data=form(**updates)
    )
    error(response, 422, 201)
    assert await query(team_env[2], "MATCH (t:TEAM) RETURN count(t) AS n") == [{"n": 0}]


@pytest.mark.parametrize(
    "updates",
    [
        {"categories": "invalid json"},
        {"sponsors": "{}"},
        {"founded_at": "not-a-date"},
    ],
)
async def test_multipart_validation_errors(team_env, updates):
    error(
        await team_env[0].post(
            "/api/teams/", headers=team_env[1][0], data=form(**updates)
        ),
        422,
        200,
    )


async def test_search_excludes_name_only_competition_placeholders(team_env):
    await create(team_env)
    await query(
        team_env[2], "CREATE (:TEAM {name:$name})", name="Synthetic Placeholder"
    )
    teams = payload(await team_env[0].get("/api/teams/search/synthetic/"))
    assert [team["name"] for team in teams] == ["Synthetic FC"]


@pytest.mark.parametrize("method,suffix", [("GET", ""), ("POST", "join/")])
async def test_name_only_placeholder_is_not_a_readable_or_joinable_team(
    team_env, method, suffix
):
    await query(team_env[2], "CREATE (:TEAM {name:$name})", name="Placeholder")
    response = await team_env[0].request(
        method,
        "/api/teams/Placeholder/" + suffix,
        headers=team_env[1][1],
        json=join_body(),
    )
    error(response, 404, 300)
    assert await query(
        team_env[2], "MATCH (:USER)-[r:IS_MEMBER_OF]->(:TEAM) RETURN count(r) AS n"
    ) == [{"n": 0}]
