from neo4j import AsyncManagedTransaction

from eventopia.models.geo import LocationIn, LocationOut


async def insert_location(
    tx: AsyncManagedTransaction, location: LocationIn
) -> LocationOut:
    result = await tx.run(
        """CYPHER 25
        MERGE (country:COUNTRY {name:$country})
        MERGE (state:STATE {name:$state})
        MERGE (city:CITY {name:$city})
        MERGE (state)-[:IS_IN]->(country)
        MERGE (city)-[:IS_IN]->(state)
        CREATE (location:LOCATION {
            pk:randomUUID(), name:$name,
            points:point({latitude:$latitude, longitude:$longitude})
        })-[:IS_IN]->(city)
        RETURN location {
            .pk, .name,
            points: {latitude:location.points.latitude,
                     longitude:location.points.longitude}
        } AS location""",
        **location.model_dump(),
    )
    record = await result.single(strict=True)
    return LocationOut(**record["location"])
