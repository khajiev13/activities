from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from eventopia.bot.dispatcher import BotDispatcher
from eventopia.bot.poller import BotPoller
from eventopia.config import AppConfig
from eventopia.context.neo4j import Neo4jConnector
from eventopia.context.request_id import configure_logging
from eventopia.context.sqlite import SqliteConnector
from eventopia.services.account import AccountService
from eventopia.services.auth import AuthService
from eventopia.services.otp import OtpService
from eventopia.services.session import SessionService
from eventopia.telegram.gateway import TelegramGateway
from eventopia.telegram.http_gateway import HttpTelegramGateway
from eventopia.views.auth import AuthView
from eventopia.views.base import ApiView
from eventopia.views.health import HealthView
from eventopia.views.users import UsersView

if TYPE_CHECKING:
    from eventopia.storage.base import ObjectStorage


@dataclass
class Container:
    views: list[ApiView]
    neo4j: Neo4jConnector | None = None
    sqlite: SqliteConnector | None = None
    account_service: AccountService | None = None
    session_service: SessionService | None = None
    otp_service: OtpService | None = None
    auth_service: AuthService | None = None
    telegram: TelegramGateway | None = None
    _owns_telegram: bool = False
    dispatcher: BotDispatcher | None = None
    poller: BotPoller | None = None

    async def close(self) -> None:
        """Release owned resources when the application shuts down."""
        try:
            if self.neo4j is not None:
                await self.neo4j.close()
        finally:
            try:
                if self.sqlite is not None:
                    await self.sqlite.close()
            finally:
                if self._owns_telegram and self.telegram is not None:
                    await self.telegram.close()


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
    gateway = (
        telegram if telegram is not None else HttpTelegramGateway(config["telegram"])
    )
    session_service = SessionService(sqlite, config["auth"])
    otp_service = OtpService(sqlite, gateway, account_service, config["auth"])
    auth_service = AuthService(
        account_service,
        session_service,
        otp_service,
        config["telegram"],
        config["auth"],
    )
    return Container(
        views=[
            HealthView(neo4j, sqlite),
            AuthView(auth_service, config["auth"]),
            UsersView(auth_service),
        ],
        neo4j=neo4j,
        sqlite=sqlite,
        account_service=account_service,
        session_service=session_service,
        otp_service=otp_service,
        auth_service=auth_service,
        telegram=gateway,
        _owns_telegram=telegram is None,
    )


def build_bot_container(config: AppConfig) -> Container:
    configure_logging(config["app"]["log_level"])
    neo4j = Neo4jConnector(config["neo4j"])
    sqlite = SqliteConnector(config["sqlite"])
    account_service = AccountService(neo4j, sqlite, config["auth"])
    gateway = HttpTelegramGateway(config["telegram"])
    dispatcher = BotDispatcher(account_service, gateway, config["app"])
    poller = BotPoller(dispatcher, gateway, sqlite, config["telegram"])
    return Container(
        views=[],
        neo4j=neo4j,
        sqlite=sqlite,
        account_service=account_service,
        telegram=gateway,
        _owns_telegram=True,
        dispatcher=dispatcher,
        poller=poller,
    )
