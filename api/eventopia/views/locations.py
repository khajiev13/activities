from fastapi import Depends

from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.models.geo import LocationIn
from eventopia.services.auth import AuthService
from eventopia.services.location import LocationService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class LocationsView(ApiView):
    def __init__(
        self, location_service: LocationService, auth_service: AuthService
    ) -> None:
        super().__init__()
        self._location_service = location_service
        current_user = build_current_user(auth_service)

        async def create_location(
            body: LocationIn, claims: AccessClaims = Depends(current_user)
        ) -> dict:
            return ok((await self._location_service.create_location(body)).model_dump())

        self.router.add_api_route(
            "/api/locations/", create_location, methods=["POST"], status_code=201
        )
