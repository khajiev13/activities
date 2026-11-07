from typing import Annotated, Literal

from fastapi import Depends, Form, Query, UploadFile

from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.models.teams import JoinTeamIn, TeamIn
from eventopia.services.auth import AuthService
from eventopia.services.team import TeamService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class TeamForm(TeamIn):
    image: UploadFile | None = None


class TeamsView(ApiView):
    def __init__(self, team_service: TeamService, auth_service: AuthService) -> None:
        super().__init__()
        self._team_service = team_service
        current_user = build_current_user(auth_service)

        async def search(q: str) -> dict:
            return ok(
                [team.model_dump() for team in await self._team_service.search_teams(q)]
            )

        async def search_geo(
            level: Literal["country", "state", "city"],
            csv: str,
            search_by: str = "",
            countries: list[str] = Query(default=[], alias="countries[]"),
            states: list[str] = Query(default=[], alias="states[]"),
        ) -> dict:
            teams = await self._team_service.search_by_geo(
                level, csv, countries, states, search_by
            )
            return ok([team.model_dump() for team in teams])

        async def create(
            body: Annotated[TeamForm, Form(media_type="multipart/form-data")],
            claims: AccessClaims = Depends(current_user),
        ) -> dict:
            created = await self._team_service.create_team(
                claims.uid, body, await body.image.read() if body.image else None
            )
            return ok(created.model_dump())

        async def detail(name: str) -> dict:
            return ok((await self._team_service.get_team(name)).model_dump())

        async def join(
            name: str, body: JoinTeamIn, claims: AccessClaims = Depends(current_user)
        ) -> dict:
            return ok(
                (
                    await self._team_service.join_team(claims.uid, name, body)
                ).model_dump()
            )

        self.router.add_api_route("/api/teams/search/{q}/", search, methods=["GET"])
        self.router.add_api_route(
            "/api/teams/{level}/{csv}/", search_geo, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/teams/", create, methods=["POST"], status_code=201
        )
        self.router.add_api_route("/api/teams/{name}/", detail, methods=["GET"])
        self.router.add_api_route("/api/teams/{name}/join/", join, methods=["POST"])
