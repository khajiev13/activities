import logging
from collections.abc import Sequence
from contextvars import ContextVar

import httpx

from eventopia.config import TelegramSection
from eventopia.telegram.gateway import (
    TelegramApiError,
    TelegramForbiddenError,
    TelegramGateway,
)

_telegram_request = ContextVar("telegram_request", default=False)


class _TelegramLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Bot API URLs contain the credential. Suppress only this async context's
        # library traces, before formatting URLs, payloads, or exception messages.
        return not _telegram_request.get()


_log_filter = _TelegramLogFilter()


class HttpTelegramGateway(TelegramGateway):
    def __init__(
        self,
        config: TelegramSection,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = "https://api.telegram.org/bot" + config["bot_token"]
        self._timeout = config["poll_timeout_seconds"] + 10
        self._owns_client = client is None
        self._client = (
            client
            if client is not None
            else httpx.AsyncClient(
                timeout=self._timeout,
            )
        )
        self._closed = False
        # These are the emitters in pinned httpx 0.28 / httpcore 1.0. Logger
        # filters do not propagate to child loggers, so cover each trace emitter.
        for name in (
            "httpx",
            "httpcore.connection",
            "httpcore.http11",
            "httpcore.http2",
            "httpcore.proxy",
            "httpcore.socks",
        ):
            logging.getLogger(name).addFilter(_log_filter)

    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict | None = None,
        protect_content: bool = False,
    ) -> None:
        payload = {"chat_id": chat_id, "text": text, "protect_content": protect_content}
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        result = await self._request("sendMessage", payload)
        if not isinstance(result, dict):
            raise TelegramApiError("Invalid Telegram message response")

    async def get_updates(
        self,
        offset: int | None,
        timeout: int,
        allowed_updates: Sequence[str],
    ) -> list[dict]:
        payload = {"timeout": timeout, "allowed_updates": list(allowed_updates)}
        if offset is not None:
            payload["offset"] = offset
        result = await self._request("getUpdates", payload, timeout=timeout + 10)
        if not isinstance(result, list) or any(
            not isinstance(update, dict) for update in result
        ):
            raise TelegramApiError("Invalid Telegram updates response")
        return result

    async def _request(
        self,
        method: str,
        payload: dict,
        *,
        timeout: int = 0,
    ) -> object:
        if self._closed:
            raise TelegramApiError("Telegram gateway is closed")
        context = _telegram_request.set(True)
        try:
            try:
                response = await self._client.post(
                    self._base_url + "/" + method,
                    json=payload,
                    timeout=max(self._timeout, timeout),
                    follow_redirects=False,
                )
                if response.status_code == 403:
                    raise TelegramForbiddenError("Telegram chat unavailable")
                if not response.is_success:
                    raise TelegramApiError("Telegram request failed")
                data = response.json()
            except (httpx.HTTPError, ValueError, RuntimeError):
                # HTTP exceptions may embed token-bearing URLs. The global error
                # handler logs tracebacks, so never chain the upstream exception.
                raise TelegramApiError("Telegram request failed") from None
            if not isinstance(data, dict):
                raise TelegramApiError("Invalid Telegram response")
            if data.get("error_code") == 403:
                raise TelegramForbiddenError("Telegram chat unavailable")
            if data.get("ok") is not True or "result" not in data:
                raise TelegramApiError("Invalid Telegram response")
            return data["result"]
        finally:
            _telegram_request.reset(context)

    async def close(self) -> None:
        self._closed = True
        if self._owns_client:
            await self._client.aclose()
