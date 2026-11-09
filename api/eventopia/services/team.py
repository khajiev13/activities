import logging
from functools import partial
from typing import Literal

from neo4j.exceptions import ConstraintError

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import teams
from eventopia.exceptions import ConflictError, NotFoundError, ValidationError
from eventopia.models.teams import JoinTeamIn, TeamDetailOut, TeamIn, TeamOut
from eventopia.services.media import MediaService

_logger = logging.getLogger(__name__)


class TeamService:
    def __init__(self, neo4j: Neo4jConnector, media_service: MediaService) -> None:
        self._neo4j = neo4j
        self._media_service = media_service

    async def create_team(
        self, uid: str, team: TeamIn, image: bytes | None = None
    ) -> TeamDetailOut:
        image_url = (
            await self._media_service.upload_image("teams", image)
            if image is not None
            else None
        )
        try:
            created = await self._neo4j.write(
                partial(teams.insert_team, uid=uid, team=team, image_url=image_url)
            )
            if created is None:
                raise ValidationError(
                    "Unknown location, geography, category or organization"
                )
        except Exception as exc:
            await self._media_service.delete_by_url(image_url)
            if isinstance(exc, ConstraintError):
                raise ConflictError("Team name already exists") from None
            raise
        _logger.info("Created team %s", created.name)
        return created

    async def get_team(self, name: str) -> TeamDetailOut:
        return _require_team(
            await self._neo4j.read(partial(teams.select_team, name=name))
        )

    async def search_teams(self, query: str) -> list[TeamOut]:
        return await self._neo4j.read(partial(teams.search_teams, search_by=query))

    async def search_by_geo(
        self,
        level: Literal["country", "state", "city"],
        csv: str,
        countries: list[str],
        states: list[str],
        search_by: str,
    ) -> list[TeamOut]:
        return await self._neo4j.read(
            partial(
                teams.search_teams,
                level=level,
                names=[name.strip() for name in csv.split(",")],
                countries=countries,
                states=states,
                search_by=search_by,
            )
        )

    async def join_team(
        self, uid: str, name: str, membership: JoinTeamIn
    ) -> TeamDetailOut:
        return _require_team(
            await self._neo4j.write(
                partial(
                    teams.join_team,
                    uid=uid,
                    name=name,
                    membership=membership,
                )
            )
        )


def _require_team(team: TeamDetailOut | None) -> TeamDetailOut:
    if team is None:
        raise NotFoundError("Team not found")
    return team
