from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from eventopia.config import AppConfig
from eventopia.context.request_id import configure_logging
from eventopia.views.base import ApiView
from eventopia.views.health import HealthView

if TYPE_CHECKING:
    from eventopia.storage.base import ObjectStorage
    from eventopia.telegram.base import TelegramGateway


@dataclass
class Container:
    views: list[ApiView]

    async def close(self) -> None:
        """Release owned resources when the application shuts down."""


def build_container(
    config: AppConfig,
    *,
    telegram: TelegramGateway | None = None,
    storage: ObjectStorage | None = None,
) -> Container:
    configure_logging(config["app"]["log_level"])
    return Container(views=[HealthView()])
