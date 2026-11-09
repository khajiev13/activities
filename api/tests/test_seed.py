import json
from pathlib import Path
from random import Random
from uuid import NAMESPACE_URL, uuid5

import pytest

from eventopia.cyphers import categories, geo, organizations, teams

DATA = Path(__file__).resolve().parents[1] / "eventopia" / "seed" / "data"


async def _seed(connector, data=DATA, random_seed=1):
    # Import in the test so a missing implementation is an explicit RED assertion.
    try:
        from eventopia.seed.loader import seed_all
    except ImportError:
        pytest.fail("Task 15 seed_all is not implemented")
    return await seed_all(connector, data, Random(random_seed))


async def _rows(connector, query, **params):
    async def read(tx):
        result = await tx.run("CYPHER 25 " + query, **params)
        return [dict(row) async for row in result]

    return await connector.read(read)


async def _write(connector, query, **params):
    async def write(tx):
        result = await tx.run("CYPHER 25 " + query, **params)
        await result.consume()

    await connector.write(write)


async def _snapshot(connector):
    return (
        await _rows(
            connector,
            "MATCH (n) RETURN elementId(n) AS id, "
            "labels(n) AS labels, n { .* } AS properties ORDER BY id",
        ),
        await _rows(
            connector,
            "MATCH (a)-[r]->(b) RETURN elementId(r) AS id, "
            "elementId(a) AS start, elementId(b) AS end, type(r) AS type, "
            "properties(r) AS properties ORDER BY id",
        ),
    )


async def test_seed_counts_and_full_graph_idempotency(neo4j_connector):
    summary = await _seed(neo4j_connector)
    assert (
        summary.teams,
        summary.players,
        summary.memberships,
        summary.leagues,
        summary.pitches,
    ) == (48, 943, 1064, 3, 4)
    await _write(
        neo4j_connector,
        """MATCH (u:USER)-[r:IS_MEMBER_OF]->
        (t:TEAM {name:'Afrika Utd 7s'})
        SET r.position='Goalkeeper', r.player_number=99,
            r.joined_at=datetime('2020-01-01T00:00:00Z'),
            t.founded_at=datetime('1999-01-01T00:00:00Z')
        WITH DISTINCT t MATCH (t)-[:BASED_IN]->(l:LOCATION)
        SET l.points=point({latitude:39.5, longitude:116.1})""",
    )
    before = await _snapshot(neo4j_connector)
    assert await _seed(neo4j_connector, random_seed=999) == summary
    assert await _snapshot(neo4j_connector) == before
    counts = await _rows(
        neo4j_connector,
        """RETURN
        COUNT { MATCH (:TEAM) } AS teams, COUNT { MATCH (:USER) } AS players,
        COUNT { MATCH (:USER)-[:IS_MEMBER_OF]->(:TEAM) } AS memberships,
        COUNT { MATCH (:LEAGUE) } AS leagues,
        COUNT { MATCH (:ACTIVITY) } + COUNT { MATCH (:COMPETITION) } AS results""",
    )
    assert counts == [
        dict(teams=48, players=943, memberships=1064, leagues=3, results=0)
    ]


async def test_7s_renamed_and_have_correct_memberships(neo4j_connector):
    await _seed(neo4j_connector)
    rows = await _rows(
        neo4j_connector,
        """MATCH (t:TEAM)
        WHERE t.name IN ['Afrika Utd', 'Afrika Utd 7s', 'Sexy FC 7s']
        RETURN t.name AS name, COUNT { MATCH (:USER)-[:IS_MEMBER_OF]->(t) } AS n,
        COLLECT { MATCH (:USER)-[r:IS_MEMBER_OF]->(t)
                  RETURN DISTINCT r.plays_for_division AS division } AS divisions
        ORDER BY name""",
    )
    assert len(rows) == 3
    assert all(row["n"] > 0 for row in rows)
    assert {row["name"]: row["divisions"] for row in rows} == {
        "Afrika Utd": [1],
        "Afrika Utd 7s": [1],
        "Sexy FC 7s": [2],
    }


async def test_female_teams_flagged(neo4j_connector):
    await _seed(neo4j_connector)
    assert await _rows(
        neo4j_connector,
        """MATCH (t:TEAM)
        RETURN count(CASE WHEN t.men_team = false THEN 1 END) AS women,
               count(CASE WHEN t.men_team = true THEN 1 END) AS men""",
    ) == [{"women": 10, "men": 38}]


async def test_no_personal_fields_and_nationalities_linked(neo4j_connector):
    await _seed(neo4j_connector)
    assert await _rows(
        neo4j_connector,
        """MATCH (u:USER)
        RETURN count(CASE WHEN any(k IN keys(u) WHERE k IN
            ['birthday', 'birth_date', 'date', 'email', 'password']) THEN 1 END)
            AS private_fields,
        count(CASE WHEN u.claimed = false AND
            EXISTS { MATCH (u)-[:IS_FROM]->(:COUNTRY) } THEN 1 END) AS players""",
    ) == [{"private_fields": 0, "players": 943}]


async def test_positions_divisions_and_jersey_data_on_memberships(neo4j_connector):
    await _seed(neo4j_connector)
    assert await _rows(
        neo4j_connector,
        """MATCH (:USER)-[r:IS_MEMBER_OF]->(:TEAM)
        WHERE r.position IS NULL OR NOT r.position IN
            ['Goalkeeper','Defender','Midfielder','Forward']
           OR r.plays_for_division IS NULL OR NOT r.plays_for_division IN [1,2,3]
           OR r.player_number IS NULL OR r.name_on_jersey IS NULL
           OR r.joined_at IS NULL RETURN count(r) AS invalid""",
    ) == [{"invalid": 0}]
    assert await _rows(neo4j_connector, "MATCH (r:ROLE) RETURN count(r) AS roles") == [
        {"roles": 0}
    ]


async def test_source_leagues_pitches_and_geo(neo4j_connector):
    await _seed(neo4j_connector)
    leagues = await _rows(
        neo4j_connector,
        """MATCH (o:ORGANIZATION)-[:HOSTS]->(l:LEAGUE)
        RETURN o.name AS host, l.name AS name, toString(l.start_date) AS start,
            toString(l.end_date) AS end,
            COLLECT { MATCH (t:TEAM)-[:PARTICIPATES_IN]->(l)
                      RETURN t.name AS team ORDER BY team } AS teams
        ORDER BY name""",
    )
    assert leagues == [
        dict(
            host="Beijing Football Association",
            name="24-25 Division 1",
            start="2024-08-01",
            end="2025-06-30",
            teams=sorted(
                [
                    "Afrika Utd",
                    "Forbidden City",
                    "Añejo FC",
                    "Sexy FC",
                    "Beijing Celtic",
                    "Beijing Rockets",
                    "A爆清风明月",
                    "Beijing Barbarians",
                ]
            ),
        ),
        dict(
            host="Beijing Football Association",
            name="24-25 Division 2",
            start="2024-08-01",
            end="2025-06-30",
            teams=sorted(
                [
                    "Shuòguǒ 硕果 FC",
                    "CYPR",
                    "Origin FC",
                    "Maxyeild United",
                    "Beijing 炎龙",
                    "Changying FC",
                    "French LEquipe",
                    "Red Cards",
                ]
            ),
        ),
        dict(
            host="Beijing Football Association",
            name="24-25 Division 3",
            start="2024-08-01",
            end="2025-06-30",
            teams=[],
        ),
    ]
    pitches = await _rows(
        neo4j_connector,
        """MATCH (l:LOCATION)-[:HAS_FACILITY]->
        (:CATEGORY {name_key:'soccer'})
        MATCH (l)-[:IS_IN]->(:CITY {name:'Beijing'})-[:IS_IN]->(:STATE {name:'Beijing'})
            -[:IS_IN]->(:COUNTRY {name:'China'})
        RETURN l.name AS name, l.points.longitude AS lon, l.points.latitude AS lat
        ORDER BY name""",
    )
    assert pitches == [
        dict(name="Ba Shang Chun Qiu", lon=116.481, lat=40.008),
        dict(name="Changying Sports Park", lon=116.588, lat=39.928),
        dict(name="Elements Ao Gua Sports Park", lon=116.419, lat=40.075),
        dict(name="UBP Ling Miao Football Pitch", lon=116.447, lat=40.045),
    ]


async def test_seed_is_compatible_with_existing_read_models(neo4j_connector):
    await _seed(neo4j_connector)
    detail = await neo4j_connector.read(
        lambda tx: teams.select_team(tx, "Afrika Utd 7s")
    )
    assert detail is not None and detail.members and detail.men_team
    assert len(detail.categories) == len(detail.location) == 1
    assert all(
        len(getattr(detail, field)) == 1
        for field in (
            "tshirt_color",
            "shorts_color",
            "socks_color",
            "away_tshirt_color",
        )
    )
    search = await neo4j_connector.read(
        lambda tx: teams.search_teams(
            tx, "", "city", ["Beijing"], ["China"], ["Beijing"]
        )
    )
    assert len(search) == 48
    assert len(await neo4j_connector.read(organizations.list_organizations)) == 1
    assert (
        len(
            await neo4j_connector.read(
                lambda tx: categories.select_categories(tx, None, True, None)
            )
        )
        == 1
    )
    countries = await neo4j_connector.read(geo.select_countries)
    china = next(country for country in countries if country.name == "China")
    assert china.states[0].cities[0].name == "Beijing"


@pytest.fixture
def synthetic_rosters(tmp_path):
    def player(name, birthday, position="Forward"):
        return dict(
            name=name,
            birthday=birthday,
            nationality="China",
            position=position,
            player_number=7,
        )

    shared = player("Alex Smith", "1990-01-01")
    teams = [
        dict(
            name="Test A",
            established_date="2020-01-01T00:00:00",
            longitude=116.4,
            latitude=40.0,
            players=[shared, player("Alex Smith", "1991-01-01", "Defender")],
        ),
        dict(
            name="Test B",
            established_date="2021-01-01T00:00:00",
            longitude=116.5,
            latitude=40.1,
            players=[shared],
        ),
    ]
    (tmp_path / "male_division_1.json").write_text(json.dumps(teams))
    return tmp_path


async def test_identity_username_collisions_and_preserving_claimed_profiles(
    neo4j_connector, synthetic_rosters
):
    namespace = uuid5(NAMESPACE_URL, "https://eventopia.live/seed/players")
    uid = str(uuid5(namespace, "Alex Smith|1990-01-01"))
    await _write(
        neo4j_connector,
        """MERGE (u:USER {uid:$uid})
        ON CREATE SET u.username='alex_smith', u.claimed=true,
          u.first_name='Edited', u.last_name='Profile'
        MERGE (:USER {uid:'existing-user', username:'alex_smith1', claimed:true})""",
        uid=uid,
    )
    summary = await _seed(neo4j_connector, synthetic_rosters)
    assert (summary.teams, summary.players, summary.memberships) == (2, 2, 3)
    assert await _rows(
        neo4j_connector,
        """MATCH (u:USER)
        RETURN u.username AS username, u.claimed AS claimed,
            u.first_name AS first_name,
            COUNT { MATCH (u)-[:IS_MEMBER_OF]->(:TEAM) } AS teams
        ORDER BY username""",
    ) == [
        dict(username="alex_smith", claimed=True, first_name="Edited", teams=2),
        dict(username="alex_smith1", claimed=True, first_name=None, teams=0),
        dict(username="alex_smith2", claimed=False, first_name="Alex", teams=1),
    ]
    before = await _snapshot(neo4j_connector)
    await _seed(neo4j_connector, synthetic_rosters, 2)
    assert await _snapshot(neo4j_connector) == before


@pytest.mark.parametrize("canonical", [False, True])
async def test_reuse_existing_soccer_and_organization_without_overwrites(
    neo4j_connector, canonical
):
    await _write(
        neo4j_connector,
        """MERGE (c:CATEGORY {pk:'existing-category'})
        ON CREATE SET c.name='SOCCER', c.is_indoor=true, c.is_outdoor=true,
            c.is_online=false, c.name_key=$key
        MERGE (o:ORGANIZATION {name:'Beijing Football Association'})
        ON CREATE SET o.pk='existing-org', o.image_url='existing.png' """,
        key="soccer" if canonical else None,
    )
    await _seed(neo4j_connector)
    assert await _rows(
        neo4j_connector,
        """MATCH (c:CATEGORY)
        RETURN c.pk AS pk, c.name AS name, c.name_key AS key,
            c.is_indoor AS indoor""",
    ) == [dict(pk="existing-category", name="SOCCER", key="soccer", indoor=True)]
    assert await _rows(
        neo4j_connector,
        """MATCH (o:ORGANIZATION)
        RETURN o.pk AS pk, o.image_url AS image""",
    ) == [dict(pk="existing-org", image="existing.png")]
    before = await _snapshot(neo4j_connector)
    await _seed(neo4j_connector, random_seed=8)
    assert await _snapshot(neo4j_connector) == before


async def test_duplicate_roster_membership_keeps_first_jersey_number(
    neo4j_connector, synthetic_rosters
):
    path = synthetic_rosters / "male_division_1.json"
    squads = json.loads(path.read_text())
    squads[0]["players"].append({**squads[0]["players"][0], "player_number": 12})
    path.write_text(json.dumps(squads))
    summary = await _seed(neo4j_connector, synthetic_rosters)
    assert summary.memberships == 3
    assert await _rows(
        neo4j_connector,
        """MATCH (u:USER)-[r:IS_MEMBER_OF]->
        (:TEAM {name:'Test A'}) WHERE u.username='alex_smith'
        RETURN r.player_number AS number""",
    ) == [{"number": 7}]


@pytest.mark.parametrize("present", [False, True])
async def test_missing_or_null_founding_date_stays_unknown(
    neo4j_connector, synthetic_rosters, present
):
    path = synthetic_rosters / "male_division_1.json"
    squads = json.loads(path.read_text())
    if present:
        squads[0]["established_date"] = None
    else:
        squads[0].pop("established_date")
    path.write_text(json.dumps(squads))
    await _seed(neo4j_connector, synthetic_rosters)
    detail = await neo4j_connector.read(lambda tx: teams.select_team(tx, "Test A"))
    assert detail.founded_at is None


async def test_module_cli_seeds_disposable_database(
    neo4j_connector, neo4j_config, config, tmp_path
):
    import asyncio
    import os
    import subprocess
    import sys

    import yaml

    config["neo4j"] = neo4j_config
    config_path = tmp_path / "seed-test.yaml"
    config_path.write_text(yaml.safe_dump(config))
    process = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "eventopia.seed"],
        cwd=DATA.parents[2],
        env={**os.environ, "EVENTOPIA_CONFIG": str(config_path)},
        capture_output=True,
        text=True,
        timeout=60,
    )
    # Do not echo process output: configuration failures could expose secrets.
    assert process.returncode == 0
    assert "teams=48 players=943 memberships=1064 leagues=3 pitches=4" in (
        process.stdout + process.stderr
    )
    assert await _rows(neo4j_connector, "MATCH (t:TEAM) RETURN count(t) AS teams") == [
        {"teams": 48}
    ]


@pytest.mark.parametrize(
    ("name", "existing_flags", "expected_men", "expected_public"),
    [
        ("Afrika Utd", None, True, True),
        ("Añejo FC Damas", None, False, True),
        ("Afrika Utd", False, False, False),
    ],
)
async def test_seed_completes_placeholder_booleans_and_preserves_false(
    neo4j_connector, name, existing_flags, expected_men, expected_public
):
    await _write(
        neo4j_connector,
        """MERGE (t:TEAM {name:$name})
        ON CREATE SET t.men_team=$flags, t.public_team=$flags""",
        name=name,
        flags=existing_flags,
    )
    await _seed(neo4j_connector)
    detail = await neo4j_connector.read(lambda tx: teams.select_team(tx, name))
    assert detail.men_team is expected_men
    assert detail.public_team is expected_public
    assert detail.founded_at is None
    assert detail.image_url is None
    results = await neo4j_connector.read(lambda tx: teams.search_teams(tx, name))
    matching = next(team for team in results if team.name == name)
    assert matching.men_team is expected_men
    assert matching.public_team is expected_public
    before = await _snapshot(neo4j_connector)
    await _seed(neo4j_connector, random_seed=999)
    assert await _snapshot(neo4j_connector) == before
