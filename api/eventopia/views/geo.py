from eventopia.models.common import ok
from eventopia.services.geo import GeoService
from eventopia.views.base import ApiView


class GeoView(ApiView):
    def __init__(self, geo_service: GeoService) -> None:
        super().__init__()
        self._geo_service = geo_service

        async def countries() -> dict:
            return ok(
                [
                    country.model_dump()
                    for country in await self._geo_service.list_countries()
                ]
            )

        self.router.add_api_route("/api/countries/list/", countries, methods=["GET"])
