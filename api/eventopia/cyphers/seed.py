from neo4j import AsyncManagedTransaction

# These are the explicit lists in backend/core/functionss.py. Division 3 has
# no participation call there; do not infer participants from roster division.
_LEAGUES = [
    {
        "division": 1,
        "teams": [
            "Afrika Utd",
            "Forbidden City",
            "Añejo FC",
            "Sexy FC",
            "Beijing Celtic",
            "Beijing Rockets",
            "A爆清风明月",
            "Beijing Barbarians",
        ],
    },
    {
        "division": 2,
        "teams": [
            "Shuòguǒ 硕果 FC",
            "CYPR",
            "Origin FC",
            "Maxyeild United",
            "Beijing 炎龙",
            "Changying FC",
            "French LEquipe",
            "Red Cards",
        ],
    },
    {"division": 3, "teams": []},
]
_PITCHES = [
    {"name": "Ba Shang Chun Qiu", "longitude": 116.481, "latitude": 40.008},
    {"name": "Changying Sports Park", "longitude": 116.588, "latitude": 39.928},
    {"name": "Elements Ao Gua Sports Park", "longitude": 116.419, "latitude": 40.075},
    {"name": "UBP Ling Miao Football Pitch", "longitude": 116.447, "latitude": 40.045},
]
_COLOR_RELATIONSHIPS = (
    "TSHIRT_COLOR",
    "SHORTS_COLOR",
    "SOCKS_COLOR",
    "AWAY_TSHIRT_COLOR",
)


async def merge_seed(
    tx: AsyncManagedTransaction,
    teams: list[dict],
    players: list[dict],
    memberships: list[dict],
) -> None:
    # Normalize the legacy category identity without replacing its display fields.
    result = await tx.run("""CYPHER 25 MATCH (c:CATEGORY)
        WHERE c.name_key = 'soccer' OR toLower(c.name) = 'soccer'
        RETURN c { .pk } AS category ORDER BY c.name_key, c.pk LIMIT 1""")
    legacy = await result.single()
    if legacy is not None:
        result = await tx.run(
            """CYPHER 25
            MERGE (c:CATEGORY {pk:$pk}) SET c.name_key='soccer' """,
            pk=legacy["category"]["pk"],
        )
        await result.consume()
    result = await tx.run("""CYPHER 25
        MERGE (category:CATEGORY {name_key:'soccer'})
        ON CREATE SET category.pk=randomUUID(), category.name='Soccer',
            category.is_indoor=false, category.is_outdoor=true,
            category.is_online=false
        MERGE (country:COUNTRY {name:'China'})
        MERGE (state:STATE {name:'Beijing'})
        MERGE (city:CITY {name:'Beijing'})
        MERGE (city)-[:IS_IN]->(state) MERGE (state)-[:IS_IN]->(country)
        MERGE (org:ORGANIZATION {name:'Beijing Football Association'})
        ON CREATE SET org.pk=randomUUID(), org.created_at=date()""")
    await result.consume()

    result = await tx.run(
        """CYPHER 25
        MATCH (city:CITY {name:'Beijing'}), (state:STATE {name:'Beijing'}),
              (country:COUNTRY {name:'China'}), (category:CATEGORY {name_key:'soccer'})
        UNWIND $teams AS row
        MERGE (t:TEAM {name:row.name})
        ON CREATE SET t.men_team=row.men_team, t.public_team=true,
            t.founded_at=datetime(row.founded_at), t.description=row.description,
            t.image_url=row.image_url
        ON MATCH SET t.men_team=coalesce(t.men_team, row.men_team),
            t.public_team=coalesce(t.public_team, true)
        MERGE (t)-[:BASED_IN]->(location:LOCATION)
        ON CREATE SET location.pk=randomUUID(), location.name='Random place in Beijing',
            location.points=point({longitude:row.longitude, latitude:row.latitude})
        MERGE (location)-[:IS_IN]->(city)
        MERGE (t)-[:CITY_BASED_IN]->(city)
        MERGE (t)-[:STATE_BASED_IN]->(state)
        MERGE (t)-[:COUNTRY_BASED_IN]->(country)
        MERGE (t)-[:IS_TYPE_OF]->(category)""",
        teams=teams,
    )
    await result.consume()
    for index, relationship in enumerate(_COLOR_RELATIONSHIPS):
        # Only allowlisted relationship names are interpolated. Prefer any
        # existing color before choosing the new randomized candidate.
        result = await tx.run(
            f"""CYPHER 25
            UNWIND $teams AS row MATCH (t:TEAM {{name:row.name}})
            WITH t, coalesce([(t)-[:{relationship}]->(c:COLOR) | c.name][0],
                             row.colors[$index]) AS name
            MERGE (color:COLOR {{name:name}})
            MERGE (t)-[:{relationship}]->(color)""",
            teams=teams,
            index=index,
        )
        await result.consume()

    result = await tx.run("""CYPHER 25 MATCH (u:USER)
        RETURN u { .uid, .username } AS user""")
    existing = [row["user"] async for row in result]
    by_uid = {user["uid"]: user["username"] for user in existing}
    used = {user["username"] for user in existing}
    new_players = []
    for player in players:
        if player["uid"] in by_uid:
            username = by_uid[player["uid"]]
        else:
            base = player["slug"]
            username = base
            suffix = 1
            while username in used:
                username = f"{base}{suffix}"
                suffix += 1
            used.add(username)
        new_players.append(
            {
                key: value
                for key, value in {**player, "username": username}.items()
                if key != "slug"
            }
        )
    result = await tx.run(
        """CYPHER 25
        MATCH (category:CATEGORY {name_key:'soccer'})
        UNWIND $players AS row
        MERGE (u:USER {uid:row.uid})
        ON CREATE SET u.username=row.username, u.first_name=row.first_name,
            u.last_name=row.last_name, u.claimed=false, u.created_at=datetime()
        MERGE (country:COUNTRY {name:row.nationality})
        MERGE (u)-[:IS_FROM]->(country)
        MERGE (u)-[:LIKES]->(category)""",
        players=new_players,
    )
    await result.consume()
    result = await tx.run(
        """CYPHER 25 UNWIND $memberships AS row
        MATCH (u:USER {uid:row.uid}), (t:TEAM {name:row.team})
        MERGE (u)-[r:IS_MEMBER_OF]->(t)
        ON CREATE SET r.player_number=row.player_number,
            r.name_on_jersey=row.name_on_jersey, r.position=row.position,
            r.plays_for_division=row.plays_for_division, r.joined_at=datetime()""",
        memberships=memberships,
    )
    await result.consume()

    result = await tx.run(
        """CYPHER 25
        MATCH (org:ORGANIZATION {name:'Beijing Football Association'}),
              (category:CATEGORY {name_key:'soccer'}), (city:CITY {name:'Beijing'}),
              (state:STATE {name:'Beijing'}), (country:COUNTRY {name:'China'})
        UNWIND $leagues AS row
        MERGE (league:LEAGUE {name:'24-25 Division ' + toString(row.division)})
        ON CREATE SET league.start_date=date('2024-08-01'),
            league.end_date=date('2025-06-30'),
            league.description='Division ' + toString(row.division) +
                ' league for the 2024-2025 season. Some of the best teams in the city' +
                ' will compete. Hosted by the Beijing Football Association.'
        MERGE (org)-[:HOSTS]->(league)
        MERGE (league)-[:IS_TYPE_OF]->(category)
        MERGE (league)-[:CITY_BASED_IN]->(city)
        MERGE (league)-[:STATE_BASED_IN]->(state)
        MERGE (league)-[:COUNTRY_BASED_IN]->(country)
        WITH league, row UNWIND row.teams AS name
        MATCH (team:TEAM {name:name}) MERGE (team)-[:PARTICIPATES_IN]->(league)""",
        leagues=_LEAGUES,
    )
    await result.consume()
    result = await tx.run(
        """CYPHER 25
        MATCH (city:CITY {name:'Beijing'}), (category:CATEGORY {name_key:'soccer'})
        UNWIND $pitches AS row
        MERGE (pitch:LOCATION {name:row.name})
        ON CREATE SET pitch.pk=randomUUID(),
            pitch.points=point({longitude:row.longitude, latitude:row.latitude})
        MERGE (pitch)-[:IS_IN]->(city)
        MERGE (pitch)-[:HAS_FACILITY]->(category)""",
        pitches=_PITCHES,
    )
    await result.consume()
