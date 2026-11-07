import asyncio
import logging
from collections.abc import Awaitable, Callable

from eventopia.bot.dispatcher import BotDispatcher
from eventopia.config import TelegramSection
from eventopia.context.sqlite import SqliteConnector
from eventopia.sqls import bot_state
from eventopia.telegram.gateway import TelegramApiError, TelegramGateway

_logger = logging.getLogger(__name__)
_OFFSET_KEY = "getUpdates.offset"


class BotPoller:
    def __init__(
        self,
        dispatcher: BotDispatcher,
        telegram: TelegramGateway,
        sqlite: SqliteConnector,
        telegram_config: TelegramSection,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._dispatcher = dispatcher
        self._telegram = telegram
        self._sqlite = sqlite
        self._timeout = telegram_config["poll_timeout_seconds"]
        self._sleep = sleep
        self._backoff = 1

    async def run_once(self) -> int:
        async with self._sqlite.session() as session:
            saved = await bot_state.get_value(session, _OFFSET_KEY)
        offset = int(saved) if saved is not None else None
        try:
            updates = await self._telegram.get_updates(
                offset=offset,
                timeout=self._timeout,
                allowed_updates=["message", "my_chat_member"],
            )
        except (TelegramApiError, OSError, TimeoutError) as error:
            _logger.warning("Telegram polling failed: %s", type(error).__name__)
            await self._sleep(self._backoff)
            self._backoff = min(self._backoff * 2, 30)
            return 0
        self._backoff = 1
        for update in updates:
            update_id = update["update_id"]
            try:
                await self._dispatcher.handle_update(update)
            except Exception as error:
                # Exceptions may contain contacts, tokens or Telegram payloads.
                _logger.warning(
                    "Bot update %s failed: %s", update_id, type(error).__name__
                )
            async with self._sqlite.session(write=True) as session:
                await bot_state.set_value(session, _OFFSET_KEY, str(update_id + 1))
        return len(updates)

    async def run_forever(self) -> None:
        while True:
            await self.run_once()
