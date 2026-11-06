from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from eventopia.config import AppConfig
from eventopia.context.neo4j import Neo4jConnector
from eventopia.context.request_id import configure_logging
from eventopia.context.sqlite import SqliteConnector
from eventopia.services.account import AccountService
from eventopia.services.session import SessionService
from eventopia.views.base import ApiView
from eventopia.views.health import HealthView

if TYPE_CHECKING:
    from eventopia.storage.base import ObjectStorage
    from eventopia.telegram.base import TelegramGateway


@dataclass
class Container:
    views: list[ApiView]
    neo4j: Neo4jConnector | None = None
    sqlite: SqliteConnector | None = None
    account_service: AccountService | None = None
    session_service: SessionService | None = None

    async def close(self) -> None:
        """Release owned resources when the application shuts down."""
        try:
            if self.neo4j is not None:
                await self.neo4j.close()
        finally:
            if self.sqlite is not None:
                await self.sqlite.close()


def build_container(
    config: AppConfig,
    *,
    telegram: TelegramGateway | None = None,
    storage: ObjectStorage | None = None,
) -> Container:
    configure_logging(config["app"]["log_level"])
    neo4j = Neo4jConnector(config["neo4j"])
    sqlite = SqliteConnector(config["sqlite"])
    account_service = AccountService(neo4j, sqlite, config["auth"])
    return Container(
        views=[HealthView(neo4j, sqlite)],
        neo4j=neo4j,
        sqlite=sqlite,
        account_service=account_service,
        session_service=SessionService(sqlite, config["auth"]),
    )
