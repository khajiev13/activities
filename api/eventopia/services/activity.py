import logging
from functools import partial
from typing import Literal

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import activities
from eventopia.exceptions import NotFoundError, ValidationError
from eventopia.models.activities import ActivityIn, ActivityOut

_logger = logging.getLogger(__name__)


class ActivityService:
    def __init__(self, neo4j: Neo4jConnector) -> None:
        self._neo4j = neo4j

    async def create_activity(self, uid: str, activity: ActivityIn) -> ActivityOut:
        created = await self._neo4j.write(
            partial(activities.insert_activity, uid=uid, activity=activity)
        )
        if created is None:
            raise ValidationError("Unknown location, geography or category")
        _logger.info("Created activity %s", created.pk)
        return created

    async def get_activity(self, pk: str) -> ActivityOut:
        return _require_activity(
            await self._neo4j.read(partial(activities.select_activity, pk=pk))
        )

    async def search_activities(
        self,
        level: Literal["country", "state", "city"],
        csv: str,
        countries: list[str],
        states: list[str],
        search_by: str,
    ) -> list[ActivityOut]:
        return await self._neo4j.read(
            partial(
                activities.search_activities,
                level=level,
                names=[name.strip() for name in csv.split(",")],
                countries=countries,
                states=states,
                search_by=search_by,
            )
        )

    async def join_activity(self, uid: str, pk: str) -> ActivityOut:
        return _require_activity(
            await self._neo4j.write(partial(activities.join_activity, uid=uid, pk=pk))
        )

    async def leave_activity(self, uid: str, pk: str) -> ActivityOut:
        return _require_activity(
            await self._neo4j.write(partial(activities.leave_activity, uid=uid, pk=pk))
        )


def _require_activity(activity: ActivityOut | None) -> ActivityOut:
    if activity is None:
        raise NotFoundError("Activity not found")
    return activity
