from typing import Literal

from neo4j import AsyncManagedTransaction

from eventopia.models.organizations import (
    OrganizationIn,
    OrganizationOut,
    OrganizationRef,
)

_GEO = """
    MATCH (o:ORGANIZATION)-[:LOCATED_AT]->(location:LOCATION)
        -[:IS_IN]->(city:CITY)-[:IS_IN]->(state:STATE)-[:IS_IN]->(country:COUNTRY)
"""
_FIELDS = """
    .pk, .name, .image_url, created_at:toString(o.created_at),
    location:location {
        .pk, .name,
        points:{latitude:location.points.latitude, longitude:location.points.longitude}
    },
    country:country { .name }, state:state { .name }, city:city { .name },
    teams_count:size(COLLECT {
        MATCH (o)-[:HAS_TEAM]->(t:TEAM) RETURN DISTINCT elementId(t) AS id
    }),
    number_of_people_joined:size(COLLECT {
        MATCH (u:USER)-[:BELONGS_TO]->(o) RETURN DISTINCT elementId(u) AS id
    }),
    number_of_teams_sponsored:size(COLLECT {
        MATCH (o)-[:SPONSORS]->(t:TEAM) RETURN DISTINCT elementId(t) AS id
    }),
    hosting_leagues_count:size(COLLECT {
        MATCH (o)-[:HOSTS]->(l:LEAGUE) RETURN DISTINCT elementId(l) AS id
    }),
    hosting_activities_count:size(COLLECT {
        MATCH (o)-[:HOSTS]->(a:ACTIVITY) RETURN DISTINCT elementId(a) AS id
    })
"""


async def list_organizations(tx: AsyncManagedTransaction) -> list[OrganizationRef]:
    result = await tx.run(
        "CYPHER 25 MATCH (o:ORGANIZATION) "
        "RETURN o { .pk, .name } AS organization "
        "ORDER BY organization.name, organization.pk"
    )
    return [OrganizationRef(**record["organization"]) async for record in result]


async def search_organizations(
    tx: AsyncManagedTransaction,
    level: Literal["country", "state", "city"],
    names: list[str],
    countries: list[str],
    states: list[str],
    search_by: str,
) -> list[OrganizationOut]:
    result = await tx.run(
        "CYPHER 25 "
        + _GEO
        + """
        WHERE toLower(o.name) CONTAINS toLower($search_by)
        AND CASE $level
            WHEN 'country' THEN country.name IN $names
            WHEN 'state' THEN state.name IN $names
            WHEN 'city' THEN city.name IN $names
        END
        AND ($level = 'country' OR size($countries) = 0 OR country.name IN $countries)
        AND ($level <> 'city' OR size($states) = 0 OR state.name IN $states)
        RETURN DISTINCT o {"""
        + _FIELDS
        + "} AS organization ORDER BY organization.name, organization.pk",
        level=level,
        names=names,
        countries=countries,
        states=states,
        search_by=search_by,
    )
    return [OrganizationOut(**record["organization"]) async for record in result]


async def insert_organization(
    tx: AsyncManagedTransaction,
    uid: str,
    organization: OrganizationIn,
    image_url: str | None,
) -> OrganizationOut | None:
    result = await tx.run(
        """CYPHER 25
        MATCH (creator:USER {uid:$uid})
        MATCH (location:LOCATION {pk:$pk_for_location})
            -[:IS_IN]->(city:CITY {name:$city})
            -[:IS_IN]->(state:STATE {name:$state})
            -[:IS_IN]->(country:COUNTRY {name:$country})
        WITH DISTINCT creator, location, city, state, country
        CREATE (o:ORGANIZATION {
            pk:randomUUID(), name:$name, created_at:date(), image_url:$image_url
        })
        CREATE (creator)-[:CREATES]->(o), (o)-[:LOCATED_AT]->(location),
            (o)-[:CITY_BASED_IN]->(city), (o)-[:STATE_BASED_IN]->(state),
            (o)-[:COUNTRY_BASED_IN]->(country)
        RETURN o {"""
        + _FIELDS
        + "} AS organization",
        uid=uid,
        image_url=image_url,
        **organization.model_dump(exclude={"image"}),
    )
    record = await result.single()
    return OrganizationOut(**record["organization"]) if record is not None else None
