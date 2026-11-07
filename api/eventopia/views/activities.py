from typing import Literal

from fastapi import Depends, Query

from eventopia.models.activities import ActivityIn
from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.services.activity import ActivityService
from eventopia.services.auth import AuthService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class ActivitiesView(ApiView):
    def __init__(
        self, activity_service: ActivityService, auth_service: AuthService
    ) -> None:
        super().__init__()
        self._activity_service = activity_service
        current_user = build_current_user(auth_service)

        async def search(
            level: Literal["country", "state", "city"],
            csv: str,
            search_by: str = "",
            countries: list[str] = Query(default=[], alias="countries[]"),
            states: list[str] = Query(default=[], alias="states[]"),
        ) -> dict:
            found = await self._activity_service.search_activities(
                level, csv, countries, states, search_by
            )
            return ok([activity.model_dump() for activity in found])

        async def create(
            body: ActivityIn, claims: AccessClaims = Depends(current_user)
        ) -> dict:
            created = await self._activity_service.create_activity(claims.uid, body)
            return ok(created.model_dump())

        async def detail(pk: str) -> dict:
            return ok((await self._activity_service.get_activity(pk)).model_dump())

        async def join(pk: str, claims: AccessClaims = Depends(current_user)) -> dict:
            return ok(
                (
                    await self._activity_service.join_activity(claims.uid, pk)
                ).model_dump()
            )

        async def leave(pk: str, claims: AccessClaims = Depends(current_user)) -> dict:
            return ok(
                (
                    await self._activity_service.leave_activity(claims.uid, pk)
                ).model_dump()
            )

        self.router.add_api_route(
            "/api/activities/{level}/{csv}/", search, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/activities/", create, methods=["POST"], status_code=201
        )
        self.router.add_api_route("/api/activities/{pk}", detail, methods=["GET"])
        self.router.add_api_route("/api/activities/{pk}/join/", join, methods=["POST"])
        self.router.add_api_route(
            "/api/activities/{pk}/leave/", leave, methods=["POST"]
        )
