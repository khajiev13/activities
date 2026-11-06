from abc import ABC, abstractmethod
from collections.abc import Sequence


class TelegramApiError(Exception):
    """Telegram request failed; messages must never contain credentials or payloads."""


class TelegramForbiddenError(TelegramApiError):
    pass


class TelegramGateway(ABC):
    @abstractmethod
    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict | None = None,
        protect_content: bool = False,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_updates(
        self,
        offset: int | None,
        timeout: int,
        allowed_updates: Sequence[str],
    ) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        raise NotImplementedError
