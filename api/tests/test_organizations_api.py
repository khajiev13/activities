import asyncio
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID

import httpx
import pytest
from neo4j.exceptions import ConstraintError

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
    assert response.headers["X-Request-ID"] == body["requestId"]


@pytest.fixture
async def org_env(config, sqlite_connector, neo4j_connector, neo4j_config):
    config["sqlite"]["path"] = str(sqlite_connector._engine.url.database)
    config["neo4j"] = neo4j_config
    storage = FakeObjectStorage()
    container = build_container(config, telegram=FakeTelegramGateway(), storage=storage)
    try:
        headers = []
        for index, name in enumerate(("org_owner", "other_owner"), 1):
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
            "UNWIND $geographies AS geo "
            "CREATE (country:COUNTRY {name:geo.country}), "
            "(state:STATE {name:geo.state})-[:IS_IN]->(country), "
            "(city:CITY {name:geo.city})-[:IS_IN]->(state), "
            "(:LOCATION {pk:geo.pk, name:geo.name, "
            "points:point({latitude:41.3, longitude:69.2})})-[:IS_IN]->(city)",
            geographies=[
                {
                    "country": "Country A",
                    "state": "State A",
                    "city": "City A",
                    "pk": "park-a",
                    "name": "Park A",
                },
                {
                    "country": "Country B",
                    "state": "State B",
                    "city": "City B",
                    "pk": "park-b",
                    "name": "Park B",
                },
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
        "name": "Synthetic Association",
        "pk_for_location": "park-a",
        "country": "Country A",
        "state": "State A",
        "city": "City A",
        **updates,
    }


async def create(env, **updates):
    return payload(
        await env[0].post(
            "/api/organizations/", headers=env[1][0], data=form(**updates)
        ),
        201,
    )


@pytest.fixture
async def search_env(org_env):
    await query(
        org_env[2],
        "UNWIND $organizations AS item "
        "MATCH (l:LOCATION {pk:item.location})-[:IS_IN]->(city:CITY) "
        "-[:IS_IN]->(state:STATE)-[:IS_IN]->(country:COUNTRY) "
        "CREATE (o:ORGANIZATION {pk:item.pk, name:item.name, created_at:date()}) "
        "CREATE (o)-[:LOCATED_AT]->(l), (o)-[:CITY_BASED_IN]->(city), "
        "(o)-[:STATE_BASED_IN]->(state), (o)-[:COUNTRY_BASED_IN]->(country)",
        organizations=[
            {"pk": "org-a", "name": "Synthetic Association", "location": "park-a"},
            {"pk": "org-b", "name": "Other Association", "location": "park-b"},
        ],
    )
    return org_env


COUNT_KEYS = {
    "teams_count",
    "number_of_people_joined",
    "number_of_teams_sponsored",
    "hosting_leagues_count",
    "hosting_activities_count",
}
LIST_KEYS = {
    "pk",
    "name",
    "created_at",
    "location",
    "country",
    "state",
    "city",
    "image_url",
} | COUNT_KEYS


async def test_create_contract_and_authenticated_ownership(org_env):
    organization = await create(org_env, creator="other_owner", founder="other_owner")
    assert set(organization) == LIST_KEYS
    assert UUID(organization["pk"]).version == 4
    assert organization["name"] == "Synthetic Association"
    assert date.fromisoformat(organization["created_at"]) == datetime.now(UTC).date()
    assert organization["image_url"] is None
    assert organization["location"] == {
        "pk": "park-a",
        "name": "Park A",
        "points": {"latitude": 41.3, "longitude": 69.2},
    }
    assert organization["country"] == {"name": "Country A"}
    assert organization["state"] == {"name": "State A"}
    assert organization["city"] == {"name": "City A"}
    assert {key: organization[key] for key in COUNT_KEYS} == dict.fromkeys(
        COUNT_KEYS, 0
    )
    assert await query(
        org_env[2],
        "MATCH (u:USER)-[:CREATES]->(o:ORGANIZATION {pk:$pk}) "
        "MATCH (o)-[:LOCATED_AT]->(:LOCATION {pk:'park-a'}) "
        "MATCH (o)-[:CITY_BASED_IN]->(:CITY {name:'City A'}) "
        "MATCH (o)-[:STATE_BASED_IN]->(:STATE {name:'State A'}) "
        "MATCH (o)-[:COUNTRY_BASED_IN]->(:COUNTRY {name:'Country A'}) "
        "RETURN u.username AS owner",
        pk=organization["pk"],
    ) == [{"owner": "org_owner"}]


async def test_list_without_filter_returns_exact_select_contract(search_env):
    organizations = payload(await search_env[0].get("/api/organizations/list/"))
    assert [o["name"] for o in organizations] == [
        "Other Association",
        "Synthetic Association",
    ]
    assert all(set(o) == {"pk", "name"} for o in organizations)
    assert len({o["pk"] for o in organizations}) == 2


async def test_empty_list_is_public(org_env):
    assert payload(await org_env[0].get("/api/organizations/list/")) == []


async def test_state_search_filters(search_env):
    organizations = payload(
        await search_env[0].get("/api/organizations/state/State%20A/")
    )
    assert [o["name"] for o in organizations] == ["Synthetic Association"]
    assert set(organizations[0]) == LIST_KEYS
    assert organizations[0]["image_url"] is None
    assert {key: organizations[0][key] for key in COUNT_KEYS} == dict.fromkeys(
        COUNT_KEYS, 0
    )


@pytest.mark.parametrize(
    "level,csv,params,want",
    [
        (
            "country",
            " Country A, Country B ",
            {},
            ["Other Association", "Synthetic Association"],
        ),
        ("country", "Country A", {}, ["Synthetic Association"]),
        ("country", "Missing", {}, []),
        ("state", "State A", {"countries[]": "Country A"}, ["Synthetic Association"]),
        ("state", "State A", {"countries[]": "Country B"}, []),
        ("city", "City A", {}, ["Synthetic Association"]),
        (
            "city",
            "City A",
            {"countries[]": "Country A", "states[]": "State A"},
            ["Synthetic Association"],
        ),
        ("city", "City A", {"countries[]": "Country B"}, []),
        ("city", "City A", {"states[]": "State B"}, []),
        (
            "city",
            "City A",
            {"countries[]": ["Country B", "Country A"]},
            ["Synthetic Association"],
        ),
        (
            "country",
            "Country A,Country B",
            {"search_by": "THETIC ASS"},
            ["Synthetic Association"],
        ),
        ("state", "State A", {"search_by": "other"}, []),
    ],
)
async def test_geo_search_applies_all_filters(search_env, level, csv, params, want):
    organizations = payload(
        await search_env[0].get(f"/api/organizations/{level}/{csv}/", params=params)
    )
    assert [o["name"] for o in organizations] == want
    assert all(set(o) == LIST_KEYS for o in organizations)


@pytest.mark.parametrize(
    "key,relation,label,total,incoming",
    [
        ("teams_count", "HAS_TEAM", "TEAM", 2, False),
        ("number_of_people_joined", "BELONGS_TO", "USER", 3, True),
        ("number_of_teams_sponsored", "SPONSORS", "TEAM", 4, False),
        ("hosting_leagues_count", "HOSTS", "LEAGUE", 5, False),
        ("hosting_activities_count", "HOSTS", "ACTIVITY", 6, False),
    ],
)
async def test_counts_are_independent_and_distinct(
    org_env,
    key,
    relation,
    label,
    total,
    incoming,
):
    created = await create(org_env)
    edge = f"(n)-[:{relation}]->(o)" if incoming else f"(o)-[:{relation}]->(n)"
    await query(
        org_env[2],
        "MATCH (o:ORGANIZATION {pk:$pk}) UNWIND range(1,$total) AS i "
        f"CREATE (n:{label} {{name:'Counted ' + toString(i)}}) "
        f"CREATE {edge}, {edge}",
        pk=created["pk"],
        total=total,
    )
    organizations = payload(
        await org_env[0].get("/api/organizations/country/Country%20A/")
    )
    assert len(organizations) == 1
    expected = dict.fromkeys(COUNT_KEYS, 0)
    expected[key] = total
    assert {key: organizations[0][key] for key in COUNT_KEYS} == expected


async def test_combined_counts_are_not_multiplied_by_other_relationships(org_env):
    created = await create(org_env)
    await query(
        org_env[2],
        "MATCH (o:ORGANIZATION {pk:$pk}), (l:LOCATION {pk:'park-a'}), "
        "(c:COUNTRY {name:'Country A'}) "
        "CREATE (o)-[:LOCATED_AT]->(l), (o)-[:COUNTRY_BASED_IN]->(c) "
        "CREATE (team:TEAM {name:'Owned'}), (sponsor:TEAM {name:'Sponsored'}), "
        "(member:USER {uid:'joined'}), (league:LEAGUE {name:'League'}), "
        "(activity:ACTIVITY {pk:'hosted'}), (category:CATEGORY {pk:'irrelevant'}) "
        "CREATE (o)-[:HAS_TEAM]->(team), (o)-[:HAS_TEAM]->(team), "
        "(o)-[:SPONSORS]->(sponsor), (member)-[:BELONGS_TO]->(o), "
        "(member)-[:BELONGS_TO]->(o), (o)-[:HOSTS]->(league), "
        "(o)-[:HOSTS]->(activity), (o)-[:IS_TYPE_OF]->(category), "
        "(o)-[:HOSTS]->(team), (o)-[:HAS_TEAM]->(category), "
        "(o)-[:BELONGS_TO]->(member)",
        pk=created["pk"],
    )
    organizations = payload(
        await org_env[0].get("/api/organizations/country/Country%20A/")
    )
    assert len(organizations) == 1
    assert {key: organizations[0][key] for key in COUNT_KEYS} == dict.fromkeys(
        COUNT_KEYS, 1
    )


async def test_image_upload_uses_detected_type_and_persists_absolute_url(org_env):
    image = (Path(__file__).parent / "fixtures/tiny.png").read_bytes()
    created = payload(
        await org_env[0].post(
            "/api/organizations/",
            headers=org_env[1][0],
            data=form(),
            files={"image": ("untrusted.exe", image, "application/octet-stream")},
        ),
        201,
    )
    assert created["image_url"].startswith(
        "http://localhost:5173/media/public/organizations/"
    )
    assert created["image_url"].endswith(".png")
    assert list(org_env[3].objects.values()) == [(image, "image/png")]
    found = payload(await org_env[0].get("/api/organizations/country/Country%20A/"))
    assert found[0]["image_url"] == created["image_url"]


async def test_duplicate_name_rolls_back_and_compensates_uploaded_media(
    org_env, monkeypatch
):
    first = await create(org_env)
    storage = org_env[3]
    uploaded = []
    original_put = storage.put

    async def put(key, data, content_type):
        await original_put(key, data, content_type)
        uploaded.append(key)

    monkeypatch.setattr(storage, "put", put)
    image = (Path(__file__).parent / "fixtures/tiny.png").read_bytes()
    error(
        await org_env[0].post(
            "/api/organizations/",
            headers=org_env[1][1],
            data=form(
                pk_for_location="park-b",
                country="Country B",
                state="State B",
                city="City B",
            ),
            files={"image": ("org.png", image, "image/png")},
        ),
        409,
        400,
    )
    assert len(uploaded) == 1 and storage.objects == {}
    assert await query(org_env[2], "MATCH (o:ORGANIZATION) RETURN count(o) AS n") == [
        {"n": 1}
    ]
    assert payload(await org_env[0].get("/api/organizations/country/Country%20A/")) == [
        first
    ]
    assert (
        payload(await org_env[0].get("/api/organizations/country/Country%20B/")) == []
    )
    assert await query(
        org_env[2], "MATCH (:USER)-[r:CREATES]->(:ORGANIZATION) RETURN count(r) AS n"
    ) == [{"n": 1}]


async def test_organization_name_constraint_rejects_real_duplicate(neo4j_connector):
    await query(
        neo4j_connector,
        "CREATE (:ORGANIZATION {pk:'first', name:'Same Name'})",
    )
    with pytest.raises(ConstraintError):
        await query(
            neo4j_connector,
            "CREATE (:ORGANIZATION {pk:'second', name:'Same Name'})",
        )
    assert await query(
        neo4j_connector, "MATCH (o:ORGANIZATION) RETURN count(o) AS n"
    ) == [{"n": 1}]


async def test_concurrent_duplicate_creation_is_atomic(org_env):
    responses = await asyncio.gather(
        *[
            org_env[0].post("/api/organizations/", headers=headers, data=form())
            for headers in org_env[1]
        ]
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    assert await query(org_env[2], "MATCH (o:ORGANIZATION) RETURN count(o) AS n") == [
        {"n": 1}
    ]
    assert await query(
        org_env[2], "MATCH (:USER)-[r:CREATES]->(:ORGANIZATION) RETURN count(r) AS n"
    ) == [{"n": 1}]


async def test_name_uniqueness_is_exact_and_unicode_names_work(org_env):
    await create(org_env, name="Beijing 炎龙")
    await create(org_env, name="beijing 炎龙")
    found = payload(
        await org_env[0].get(
            "/api/organizations/country/Country%20A/", params={"search_by": "炎龙"}
        )
    )
    assert [o["name"] for o in found] == ["Beijing 炎龙", "beijing 炎龙"]


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid"}])
async def test_create_requires_auth_and_never_writes(org_env, headers):
    error(
        await org_env[0].post("/api/organizations/", headers=headers, data=form()),
        401,
        101,
    )
    assert await query(org_env[2], "MATCH (o:ORGANIZATION) RETURN count(o) AS n") == [
        {"n": 0}
    ]


@pytest.mark.parametrize(
    "updates",
    [
        {"pk_for_location": "missing"},
        {"country": "Missing"},
        {"state": "Missing"},
        {"city": "Missing"},
        {"country": "Country B"},
        {"state": "State B"},
        {"city": "City B"},
    ],
)
async def test_invalid_or_mismatched_geography_never_writes(org_env, updates):
    image = (Path(__file__).parent / "fixtures/tiny.png").read_bytes()
    error(
        await org_env[0].post(
            "/api/organizations/",
            headers=org_env[1][0],
            data=form(**updates),
            files={"image": ("org.png", image, "image/png")},
        ),
        422,
        201,
    )
    assert org_env[3].objects == {}
    assert await query(org_env[2], "MATCH (o:ORGANIZATION) RETURN count(o) AS n") == [
        {"n": 0}
    ]


@pytest.mark.parametrize(
    "field", ["name", "pk_for_location", "country", "state", "city"]
)
async def test_multipart_required_fields(org_env, field):
    data = form()
    data.pop(field)
    error(
        await org_env[0].post("/api/organizations/", headers=org_env[1][0], data=data),
        422,
        200,
    )


@pytest.mark.parametrize("name", ["", "x", "x" * 101])
async def test_name_validation(org_env, name):
    error(
        await org_env[0].post(
            "/api/organizations/", headers=org_env[1][0], data=form(name=name)
        ),
        422,
        200,
    )


@pytest.mark.parametrize(
    "image", [b"", b"not a PNG", b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024)]
)
async def test_invalid_images_never_create_graph_or_media(org_env, image):
    error(
        await org_env[0].post(
            "/api/organizations/",
            headers=org_env[1][0],
            data=form(),
            files={"image": ("org.png", image, "image/png")},
        ),
        422,
        201,
    )
    assert org_env[3].objects == {}
    assert await query(org_env[2], "MATCH (o:ORGANIZATION) RETURN count(o) AS n") == [
        {"n": 0}
    ]


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/api/organizations"),
        ("GET", "/api/organizations/list"),
        ("GET", "/api/organizations/country/Country%20A"),
        ("GET", "/api/organizations/state/State%20A"),
        ("GET", "/api/organizations/city/City%20A"),
        ("GET", "/api/organizations/missing/"),
    ],
)
async def test_paths_have_exact_slashes_and_no_detail_endpoint(org_env, method, path):
    response = await org_env[0].request(
        method, path, headers=org_env[1][0], data=form()
    )
    error(response, 404, 300)
    assert "location" not in response.headers
