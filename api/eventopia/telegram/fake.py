from collections.abc import Sequence
from copy import deepcopy
from dataclasses import dataclass

from eventopia.telegram.gateway import (
    TelegramApiError,
    TelegramForbiddenError,
    TelegramGateway,
)


@dataclass
class SentMessage:
    chat_id: int
    text: str
    reply_markup: dict | None
    protect_content: bool


class FakeTelegramGateway(TelegramGateway):
    def __init__(self) -> None:
        self.sent: list[SentMessage] = []
        self.forbidden_chat_ids: set[int] = set()
        self.updates: list[dict] = []
        self.fail_next_get_updates = 0

    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict | None = None,
        protect_content: bool = False,
    ) -> None:
        if chat_id in self.forbidden_chat_ids:
            raise TelegramForbiddenError("Telegram chat unavailable")
        self.sent.append(
            SentMessage(
                chat_id,
                text,
                deepcopy(reply_markup),
                protect_content,
            )
        )

    async def get_updates(
        self,
        offset: int | None,
        timeout: int,
        allowed_updates: Sequence[str],
    ) -> list[dict]:
        if self.fail_next_get_updates > 0:
            self.fail_next_get_updates -= 1
            raise TelegramApiError("Telegram updates unavailable")
        return deepcopy(
            [
                update
                for update in self.updates
                if (offset is None or update["update_id"] >= offset)
                and any(kind in update for kind in allowed_updates)
            ]
        )

    async def close(self) -> None:
        pass
