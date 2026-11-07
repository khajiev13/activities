from typing import Literal

from fastapi import Depends

from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.models.geo import CategoryIn
from eventopia.services.auth import AuthService
from eventopia.services.category import CategoryService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class CategoriesView(ApiView):
    def __init__(
        self, category_service: CategoryService, auth_service: AuthService
    ) -> None:
        super().__init__()
        self._category_service = category_service
        current_user = build_current_user(auth_service)

        async def list_categories(
            is_indoor: Literal["true", "false"] | None = None,
            is_outdoor: Literal["true", "false"] | None = None,
            is_online: Literal["true", "false"] | None = None,
        ) -> dict:
            categories = await self._category_service.list_categories(
                is_indoor=_parse_flag(is_indoor),
                is_outdoor=_parse_flag(is_outdoor),
                is_online=_parse_flag(is_online),
            )
            return ok([category.model_dump() for category in categories])

        async def create_category(
            body: CategoryIn, claims: AccessClaims = Depends(current_user)
        ) -> dict:
            return ok((await self._category_service.create_category(body)).model_dump())

        self.router.add_api_route("/api/categories/", list_categories, methods=["GET"])
        self.router.add_api_route(
            "/api/categories/", create_category, methods=["POST"], status_code=201
        )


def _parse_flag(value: Literal["true", "false"] | None) -> bool | None:
    return value == "true" if value is not None else None
