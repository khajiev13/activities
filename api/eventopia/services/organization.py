import logging
from functools import partial
from typing import Literal

from neo4j.exceptions import ConstraintError

from eventopia.context.neo4j import Neo4jConnector
from eventopia.cyphers import organizations
from eventopia.exceptions import ConflictError, ValidationError
from eventopia.models.organizations import (
    OrganizationIn,
    OrganizationOut,
    OrganizationRef,
)
from eventopia.services.media import MediaService

_logger = logging.getLogger(__name__)


class OrganizationService:
    def __init__(self, neo4j: Neo4jConnector, media_service: MediaService) -> None:
        self._neo4j = neo4j
        self._media_service = media_service

    async def list_organizations(self) -> list[OrganizationRef]:
        return await self._neo4j.read(organizations.list_organizations)

    async def search_by_geo(
        self,
        level: Literal["country", "state", "city"],
        csv: str,
        countries: list[str],
        states: list[str],
        search_by: str,
    ) -> list[OrganizationOut]:
        return await self._neo4j.read(
            partial(
                organizations.search_organizations,
                level=level,
                names=[name.strip() for name in csv.split(",")],
                countries=countries,
                states=states,
                search_by=search_by,
            )
        )

    async def create_organization(
        self, uid: str, organization: OrganizationIn, image: bytes | None = None
    ) -> OrganizationOut:
        image_url = (
            await self._media_service.upload_image("organizations", image)
            if image is not None
            else None
        )
        try:
            created = await self._neo4j.write(
                partial(
                    organizations.insert_organization,
                    uid=uid,
                    organization=organization,
                    image_url=image_url,
                )
            )
            if created is None:
                raise ValidationError("Unknown location or mismatched geography")
        except Exception as exc:
            await self._media_service.delete_by_url(image_url)
            if isinstance(exc, ConstraintError):
                raise ConflictError("Organization name already exists") from None
            raise
        _logger.info("Created organization %s", created.pk)
        return created
