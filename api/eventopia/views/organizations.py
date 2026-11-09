from typing import Annotated, Literal

from fastapi import Depends, Form, Query, UploadFile

from eventopia.models.auth import AccessClaims
from eventopia.models.common import ok
from eventopia.models.organizations import OrganizationIn
from eventopia.services.auth import AuthService
from eventopia.services.organization import OrganizationService
from eventopia.views.base import ApiView
from eventopia.views.deps import build_current_user


class OrganizationForm(OrganizationIn):
    image: UploadFile | None = None


class OrganizationsView(ApiView):
    def __init__(
        self,
        organization_service: OrganizationService,
        auth_service: AuthService,
        max_upload_bytes: int,
    ) -> None:
        super().__init__()
        self._organization_service = organization_service
        current_user = build_current_user(auth_service)

        async def list_organizations() -> dict:
            organizations = await self._organization_service.list_organizations()
            return ok([organization.model_dump() for organization in organizations])

        async def search_geo(
            level: Literal["country", "state", "city"],
            csv: str,
            search_by: str = "",
            countries: list[str] = Query(default=[], alias="countries[]"),
            states: list[str] = Query(default=[], alias="states[]"),
        ) -> dict:
            organizations = await self._organization_service.search_by_geo(
                level, csv, countries, states, search_by
            )
            return ok([organization.model_dump() for organization in organizations])

        async def create(
            body: Annotated[OrganizationForm, Form(media_type="multipart/form-data")],
            claims: AccessClaims = Depends(current_user),
        ) -> dict:
            created = await self._organization_service.create_organization(
                claims.uid,
                body,
                await body.image.read(max_upload_bytes + 1) if body.image else None,
            )
            return ok(created.model_dump())

        self.router.add_api_route(
            "/api/organizations/list/", list_organizations, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/organizations/{level}/{csv}/", search_geo, methods=["GET"]
        )
        self.router.add_api_route(
            "/api/organizations/", create, methods=["POST"], status_code=201
        )
