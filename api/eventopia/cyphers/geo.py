from neo4j import AsyncManagedTransaction

from eventopia.models.geo import CountryOut


async def select_countries(tx: AsyncManagedTransaction) -> list[CountryOut]:
    result = await tx.run(
        """CYPHER 25
        MATCH (country:COUNTRY)
        WHERE country.name IS NOT NULL
        RETURN country {
            .name,
            states: COLLECT {
                MATCH (country)<-[:IS_IN]-(state:STATE)
                WHERE state.name IS NOT NULL
                RETURN state {
                    .name,
                    cities: COLLECT {
                        MATCH (state)<-[:IS_IN]-(city:CITY)
                        WHERE city.name IS NOT NULL
                        RETURN city { .name } AS city
                        ORDER BY city.name
                    }
                } AS state
                ORDER BY state.name
            }
        } AS country
        ORDER BY country.name"""
    )
    return [CountryOut(**record["country"]) async for record in result]
