from fastapi import Depends

from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.services.auth import AuthService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class UsersView(ApiView):
    def __init__(self, auth_service: AuthService) -> None:
        super().__init__()
        self._auth_service = auth_service
        current_user = build_current_user(auth_service)

        async def me(claims: AccessClaims = Depends(current_user)) -> dict:
            return ok((await self._auth_service.me(claims.uid)).model_dump())

        self.router.add_api_route("/api/users/me", me, methods=["GET"])
