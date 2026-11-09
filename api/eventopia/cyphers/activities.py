from typing import Literal

from neo4j import AsyncManagedTransaction

from eventopia.models.activities import ActivityIn, ActivityOut

_GEO_MATCH = """
    MATCH (a:ACTIVITY)-[:HAPPENS_AT]->(location:LOCATION)
          -[:IS_IN]->(city:CITY)-[:IS_IN]->(state:STATE)
          -[:IS_IN]->(country:COUNTRY)
    MATCH (creator:USER)-[:CREATES]->(a)
"""
_PROJECTION = """
    WITH DISTINCT a, location, city, state, country, creator,
        COLLECT {
            MATCH (joiner:USER)-[:JOINS]->(a)
            RETURN DISTINCT joiner {
                .first_name, .last_name, .image_url, .username
            } AS person
            ORDER BY person.username
        } AS people_joined,
        [(a)-[:IS_COMPETITION]->(:COMPETITION)-[:TEAM_1]->(t:TEAM)
            | t { .name, .image_url }][0] AS team_1,
        [(a)-[:IS_COMPETITION]->(:COMPETITION)-[:TEAM_2]->(t:TEAM)
            | t { .name, .image_url }][0] AS team_2
    RETURN a {
        .pk, .title, .description, .public, .duration_in_minutes,
        date_time:toString(a.date_time),
        country:country { .name }, state:state { .name }, city:city { .name },
        location:location {
            .pk, .name,
            points:{latitude:location.points.latitude,
                    longitude:location.points.longitude}
        },
        categories:COLLECT {
            MATCH (a)-[:IS_TYPE_OF]->(category:CATEGORY)
            RETURN DISTINCT category { .pk, .name } AS category
            ORDER BY category.name, category.pk
        },
        creator:creator {
            first_name:coalesce(creator.first_name, ''),
            last_name:coalesce(creator.last_name, ''),
            image_url:coalesce(creator.image_url, ''),
            username:coalesce(creator.username, '')
        },
        competition:{
            team_1:{name:team_1.name, image_url:team_1.image_url},
            team_2:{name:team_2.name, image_url:team_2.image_url}
        },
        people_joined:people_joined,
        number_of_people_joined:size(people_joined)
    } AS activity
    ORDER BY activity.date_time, activity.pk
"""


async def select_activity(tx: AsyncManagedTransaction, pk: str) -> ActivityOut | None:
    result = await tx.run(
        "CYPHER 25 " + _GEO_MATCH + " WHERE a.pk = $pk " + _PROJECTION, pk=pk
    )
    record = await result.single()
    return ActivityOut(**record["activity"]) if record is not None else None


async def search_activities(
    tx: AsyncManagedTransaction,
    level: Literal["country", "state", "city"],
    names: list[str],
    countries: list[str],
    states: list[str],
    search_by: str,
) -> list[ActivityOut]:
    result = await tx.run(
        "CYPHER 25 "
        + _GEO_MATCH
        + """
        WHERE CASE $level
            WHEN 'country' THEN country.name IN $names
            WHEN 'state' THEN state.name IN $names
            WHEN 'city' THEN city.name IN $names
        END
        AND ($level = 'country' OR size($countries) = 0
             OR country.name IN $countries)
        AND ($level <> 'city' OR size($states) = 0 OR state.name IN $states)
        AND toLower(a.title) CONTAINS toLower($search_by)
        """
        + _PROJECTION,
        level=level,
        names=names,
        countries=countries,
        states=states,
        search_by=search_by,
    )
    return [ActivityOut(**record["activity"]) async for record in result]


async def insert_activity(
    tx: AsyncManagedTransaction, uid: str, activity: ActivityIn
) -> ActivityOut | None:
    result = await tx.run(
        """CYPHER 25
        MATCH (creator:USER {uid:$uid})
        MATCH (location:LOCATION {pk:$location})-[:IS_IN]->(city:CITY {name:$city})
              -[:IS_IN]->(state:STATE {name:$state})
              -[:IS_IN]->(country:COUNTRY {name:$country})
        WITH creator, location, city, state, country,
            COLLECT {
                MATCH (category:CATEGORY) WHERE category.pk IN $categories
                RETURN DISTINCT category.pk AS pk
            } AS category_pks
        WHERE size(category_pks) = size($categories)
        CREATE (a:ACTIVITY {
            pk:randomUUID(), title:$title, description:$description,
            duration_in_minutes:$duration_in_minutes, public:$public,
            date_time:datetime($date_time)
        })
        CREATE (creator)-[:CREATES]->(a), (a)-[:HAPPENS_AT]->(location),
               (a)-[:CITY_BASED_IN]->(city), (a)-[:STATE_BASED_IN]->(state),
               (a)-[:COUNTRY_BASED_IN]->(country)
        FOREACH (category_pk IN $categories |
            MERGE (category:CATEGORY {pk:category_pk})
            CREATE (a)-[:IS_TYPE_OF]->(category)
        )
        FOREACH (ignored IN CASE WHEN $is_competition THEN [1] ELSE [] END |
            CREATE (competition:COMPETITION {pk:randomUUID()})
            CREATE (a)-[:IS_COMPETITION]->(competition)
            MERGE (team_1:TEAM {name:$team_1})
            MERGE (team_2:TEAM {name:$team_2})
            CREATE (competition)-[:TEAM_1]->(team_1),
                   (competition)-[:TEAM_2]->(team_2)
        )
        RETURN a.pk AS pk""",
        uid=uid,
        location=activity.location.pk,
        city=activity.city.name,
        state=activity.state.name,
        country=activity.country.name,
        categories=list(dict.fromkeys(c.pk for c in activity.categories)),
        title=activity.title,
        description=activity.description,
        duration_in_minutes=activity.duration_in_minutes,
        public=activity.public,
        date_time=activity.date_time.isoformat(),
        is_competition=activity.is_competition,
        team_1=activity.competition.team_1.name if activity.competition else None,
        team_2=activity.competition.team_2.name if activity.competition else None,
    )
    record = await result.single()
    return await select_activity(tx, record["pk"]) if record is not None else None


async def join_activity(
    tx: AsyncManagedTransaction, uid: str, pk: str
) -> ActivityOut | None:
    result = await tx.run(
        """CYPHER 25
        MATCH (user:USER {uid:$uid}), (a:ACTIVITY {pk:$pk})
        MERGE (user)-[:JOINS]->(a)
        RETURN a.pk AS pk""",
        uid=uid,
        pk=pk,
    )
    record = await result.single()
    return await select_activity(tx, pk) if record is not None else None


async def leave_activity(
    tx: AsyncManagedTransaction, uid: str, pk: str
) -> ActivityOut | None:
    result = await tx.run(
        """CYPHER 25
        MATCH (user:USER {uid:$uid}), (a:ACTIVITY {pk:$pk})
        WITH a, [(user)-[membership:JOINS]->(a) | membership] AS memberships
        FOREACH (membership IN memberships | DELETE membership)
        RETURN a.pk AS pk""",
        uid=uid,
        pk=pk,
    )
    record = await result.single()
    return await select_activity(tx, pk) if record is not None else None
