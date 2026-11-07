import logging
from functools import partial

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import locations
from eventopia.models.geo import LocationIn, LocationOut

_logger = logging.getLogger(__name__)


class LocationService:
    def __init__(self, neo4j: Neo4jConnector) -> None:
        self._neo4j = neo4j

    async def create_location(self, location: LocationIn) -> LocationOut:
        created = await self._neo4j.write(
            partial(
                locations.insert_location,
                location=location,
            )
        )
        _logger.info("Created location %s", created.pk)
        return created
