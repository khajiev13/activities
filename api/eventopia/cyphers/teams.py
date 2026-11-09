from typing import Literal

from neo4j import AsyncManagedTransaction

from eventopia.exceptions import ConflictError
from eventopia.models.teams import JoinTeamIn, TeamDetailOut, TeamIn, TeamOut

_FIELDS = """
    .name, .image_url, .men_team, .public_team,
    founded_at:toString(t.founded_at),
    country_name:coalesce([(t)-[:COUNTRY_BASED_IN]->(c:COUNTRY) | c.name][0], ''),
    state_name:coalesce([(t)-[:STATE_BASED_IN]->(s:STATE) | s.name][0], ''),
    city_name:coalesce([(t)-[:CITY_BASED_IN]->(c:CITY) | c.name][0], ''),
    categories:COLLECT {
        MATCH (t)-[:IS_TYPE_OF]->(c:CATEGORY)
        RETURN DISTINCT c {
            .pk, .name, .is_indoor, .is_online, .is_outdoor
        } AS category
        ORDER BY category.name, category.pk
    },
    location:COLLECT {
        MATCH (t)-[:BASED_IN]->(l:LOCATION)
        RETURN DISTINCT l {
            .pk, .name,
            points:{latitude:l.points.latitude, longitude:l.points.longitude}
        } AS location ORDER BY location.pk
    },
    tshirt_color:COLLECT {
        MATCH (t)-[:TSHIRT_COLOR]->(c:COLOR)
        RETURN DISTINCT c { .name } AS color ORDER BY color.name
    },
    shorts_color:COLLECT {
        MATCH (t)-[:SHORTS_COLOR]->(c:COLOR)
        RETURN DISTINCT c { .name } AS color ORDER BY color.name
    },
    socks_color:COLLECT {
        MATCH (t)-[:SOCKS_COLOR]->(c:COLOR)
        RETURN DISTINCT c { .name } AS color ORDER BY color.name
    },
    away_tshirt_color:COLLECT {
        MATCH (t)-[:AWAY_TSHIRT_COLOR]->(c:COLOR)
        RETURN DISTINCT c { .name } AS color ORDER BY color.name
    }
"""
_DETAIL_FIELDS = """
    , members:COLLECT {
        MATCH (u:USER)-[r:IS_MEMBER_OF]->(t)
        RETURN DISTINCT u {
            username:coalesce(u.username, ''), first_name:coalesce(u.first_name, ''),
            last_name:coalesce(u.last_name, ''), .image_url,
            name_on_jersey:r.name_on_jersey, role:r.position,
            plays_for_division:r.plays_for_division, player_number:r.player_number
        } AS member ORDER BY member.username
    },
    sponsors:COLLECT {
        MATCH (o:ORGANIZATION)-[:SPONSORS]->(t)
        RETURN DISTINCT o { .name } AS sponsor ORDER BY sponsor.name
    },
    belongs_to_organization:COLLECT {
        MATCH (o:ORGANIZATION)-[:HAS_TEAM]->(t)
        RETURN DISTINCT o { .name } AS organization ORDER BY organization.name
    }
"""


# Competition writes may create name-only placeholders; usable teams have a location.
async def select_team(tx: AsyncManagedTransaction, name: str) -> TeamDetailOut | None:
    result = await tx.run(
        "CYPHER 25 MATCH (t:TEAM {name:$name}) "
        "WHERE EXISTS { MATCH (t)-[:BASED_IN]->(:LOCATION) } RETURN t {"
        + _FIELDS
        + _DETAIL_FIELDS
        + "} AS team",
        name=name,
    )
    record = await result.single()
    return TeamDetailOut(**record["team"]) if record is not None else None


async def search_teams(
    tx: AsyncManagedTransaction,
    search_by: str,
    level: Literal["country", "state", "city"] | None = None,
    names: list[str] | None = None,
    countries: list[str] | None = None,
    states: list[str] | None = None,
) -> list[TeamOut]:
    result = await tx.run(
        """CYPHER 25
        MATCH (t:TEAM)-[:BASED_IN]->(:LOCATION)
        WHERE toLower(t.name) CONTAINS toLower($search_by)
        AND ($level IS NULL OR EXISTS {
            MATCH (t)-[:BASED_IN]->(:LOCATION)-[:IS_IN]->(city:CITY)
                  -[:IS_IN]->(state:STATE)-[:IS_IN]->(country:COUNTRY)
            WHERE CASE $level
                WHEN 'country' THEN country.name IN $names
                WHEN 'state' THEN state.name IN $names
                WHEN 'city' THEN city.name IN $names
            END
            AND ($level = 'country' OR size($countries) = 0
                 OR country.name IN $countries)
            AND ($level <> 'city' OR size($states) = 0 OR state.name IN $states)
        })
        RETURN DISTINCT t {"""
        + _FIELDS
        + "} AS team ORDER BY team.name",
        search_by=search_by,
        level=level,
        names=names or [],
        countries=countries or [],
        states=states or [],
    )
    return [TeamOut(**record["team"]) async for record in result]


async def insert_team(
    tx: AsyncManagedTransaction, uid: str, team: TeamIn, image_url: str | None
) -> TeamDetailOut | None:
    result = await tx.run(
        """CYPHER 25
        MATCH (creator:USER {uid:$uid})
        MATCH (location:LOCATION {pk:$location})-[:IS_IN]->(city:CITY {name:$city})
              -[:IS_IN]->(state:STATE {name:$state})
              -[:IS_IN]->(country:COUNTRY {name:$country})
        WITH creator, location, city, state, country,
            COLLECT {
                MATCH (c:CATEGORY) WHERE c.pk IN $categories
                RETURN DISTINCT c.pk AS pk
            } AS category_pks,
            COLLECT {
                MATCH (o:ORGANIZATION) WHERE o.pk IN $sponsors
                RETURN DISTINCT o.pk AS pk
            } AS sponsor_pks,
            COLLECT {
                MATCH (o:ORGANIZATION {pk:$organization}) RETURN o.pk AS pk
            } AS organization_pks
        WHERE size(category_pks) = size($categories)
          AND size(sponsor_pks) = size($sponsors)
          AND ($organization IS NULL OR size(organization_pks) = 1)
        CREATE (t:TEAM {name:$name, founded_at:datetime($founded_at),
                       men_team:$men_team, public_team:$public_team,
                       image_url:$image_url})
        CREATE (creator)-[:CREATES]->(t), (t)-[:BASED_IN]->(location),
               (t)-[:CITY_BASED_IN]->(city), (t)-[:STATE_BASED_IN]->(state),
               (t)-[:COUNTRY_BASED_IN]->(country)
        CALL (t) {
            MATCH (c:CATEGORY) WHERE c.pk IN $categories
            CREATE (t)-[:IS_TYPE_OF]->(c)
        }
        CALL (t) {
            MATCH (o:ORGANIZATION) WHERE o.pk IN $sponsors
            CREATE (o)-[:SPONSORS {since:date()}]->(t)
        }
        CALL (t) {
            MATCH (o:ORGANIZATION {pk:$organization}) CREATE (o)-[:HAS_TEAM]->(t)
        }
        FOREACH (_ IN CASE WHEN $tshirt IS NULL THEN [] ELSE [1] END |
            MERGE (c:COLOR {name:$tshirt}) CREATE (t)-[:TSHIRT_COLOR]->(c))
        FOREACH (_ IN CASE WHEN $shorts IS NULL THEN [] ELSE [1] END |
            MERGE (c:COLOR {name:$shorts}) CREATE (t)-[:SHORTS_COLOR]->(c))
        FOREACH (_ IN CASE WHEN $socks IS NULL THEN [] ELSE [1] END |
            MERGE (c:COLOR {name:$socks}) CREATE (t)-[:SOCKS_COLOR]->(c))
        FOREACH (_ IN CASE WHEN $away IS NULL THEN [] ELSE [1] END |
            MERGE (c:COLOR {name:$away}) CREATE (t)-[:AWAY_TSHIRT_COLOR]->(c))
        RETURN t.name AS name""",
        uid=uid,
        name=team.name,
        location=team.location,
        city=team.city_name,
        state=team.state_name,
        country=team.country_name,
        categories=list(dict.fromkeys(c.pk for c in team.categories)),
        sponsors=list(dict.fromkeys(pk for pk in team.sponsors if pk)),
        organization=team.belongs_to_organization or None,
        founded_at=team.founded_at.isoformat() if team.founded_at else None,
        men_team=team.men_team,
        public_team=team.public_team,
        image_url=image_url,
        tshirt=team.tshirt_color or None,
        shorts=team.shorts_color or None,
        socks=team.socks_color or None,
        away=team.away_tshirt_color or None,
    )
    record = await result.single()
    return await select_team(tx, record["name"]) if record is not None else None


async def join_team(
    tx: AsyncManagedTransaction, uid: str, name: str, membership: JoinTeamIn
) -> TeamDetailOut | None:
    # Acquire the team's write lock before reading any membership conflicts.
    # Neo4j retains this lock until commit, even after removing the temporary key.
    result = await tx.run(
        """CYPHER 25 MATCH (t:TEAM {name:$name})
        WHERE EXISTS { MATCH (t)-[:BASED_IN]->(:LOCATION) }
        SET t._membership_lock = true REMOVE t._membership_lock
        RETURN t.name AS name""",
        name=name,
    )
    if await result.single() is None:
        return None
    result = await tx.run(
        """CYPHER 25 MATCH (t:TEAM {name:$name})
        RETURN EXISTS { MATCH (:USER {uid:$uid})-[:IS_MEMBER_OF]->(t) }
            OR EXISTS {
                MATCH (:USER)-[r:IS_MEMBER_OF]->(t) WHERE r.player_number = $number
            } AS conflict""",
        name=name,
        uid=uid,
        number=membership.player_number,
    )
    if (await result.single(strict=True))["conflict"]:
        raise ConflictError("Already a member or player number is taken")
    result = await tx.run(
        """CYPHER 25 MATCH (u:USER {uid:$uid}), (t:TEAM {name:$name})
        CREATE (u)-[:IS_MEMBER_OF {
            joined_at:datetime(), player_number:$number,
            name_on_jersey:$jersey, position:$position
        }]->(t) RETURN t.name AS name""",
        uid=uid,
        name=name,
        number=membership.player_number,
        jersey=membership.name_on_jersey,
        position=membership.position,
    )
    record = await result.single()
    return await select_team(tx, name) if record is not None else None
