import logging
from functools import partial

from neo4j.exceptions import ConstraintError

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import categories
from eventopia.exceptions import ConflictError
from eventopia.models.geo import CategoryIn, CategoryOut

_logger = logging.getLogger(__name__)


class CategoryService:
    def __init__(self, neo4j: Neo4jConnector) -> None:
        self._neo4j = neo4j

    async def list_categories(
        self,
        is_indoor: bool | None = None,
        is_outdoor: bool | None = None,
        is_online: bool | None = None,
    ) -> list[CategoryOut]:
        return await self._neo4j.read(
            partial(
                categories.select_categories,
                is_indoor=is_indoor,
                is_outdoor=is_outdoor,
                is_online=is_online,
            )
        )

    async def create_category(self, category: CategoryIn) -> CategoryOut:
        try:
            created = await self._neo4j.write(
                partial(
                    categories.insert_category,
                    category=category,
                )
            )
        except ConstraintError:
            raise ConflictError("Category name already exists") from None
        if created is None:
            raise ConflictError("Category name already exists")
        _logger.info("Created category %s", created.pk)
        return created
