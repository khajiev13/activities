from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import geo
from eventopia.models.geo import CountryOut


class GeoService:
    def __init__(self, neo4j: Neo4jConnector) -> None:
        self._neo4j = neo4j

    async def list_countries(self) -> list[CountryOut]:
        return await self._neo4j.read(geo.select_countries)
