import json
import logging
import traceback
from secrets import token_urlsafe

import httpx
import pytest

from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.telegram.gateway import TelegramApiError, TelegramForbiddenError
from eventopia.telegram.http_gateway import HttpTelegramGateway


@pytest.fixture
def telegram_config():
    return {
        "bot_token": token_urlsafe(32),
        "bot_username": "test_bot",
        "poll_timeout_seconds": 50,
    }


async def test_http_gateway_send_message_payload(telegram_config):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = HttpTelegramGateway(telegram_config, client)
        markup = {"remove_keyboard": True}
        await gateway.send_message(
            7, "hello", reply_markup=markup, protect_content=True
        )
        await gateway.send_message(8, "plain")
        assert len(requests) == 2
        request = requests[0]
        assert request.method == "POST"
        assert request.url.host == "api.telegram.org"
        assert request.url.scheme == "https"
        correct_path = request.url.path == (
            "/bot" + telegram_config["bot_token"] + "/sendMessage"
        )
        assert correct_path, "Telegram method path must include configured credential"
        assert json.loads(request.content) == {
            "chat_id": 7,
            "text": "hello",
            "reply_markup": markup,
            "protect_content": True,
        }
        assert json.loads(requests[1].content) == {
            "chat_id": 8,
            "text": "plain",
            "protect_content": False,
        }
        assert all(value >= 60 for value in request.extensions["timeout"].values())
        await gateway.close()
        assert not client.is_closed  # Injected clients remain caller-owned.


async def test_get_updates_params(telegram_config):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "ok": True,
                "result": [{"update_id": 42, "message": {"text": "hello"}}],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = HttpTelegramGateway(telegram_config, client)
        result = await gateway.get_updates(42, 50, ["message", "my_chat_member"])
        assert result == [{"update_id": 42, "message": {"text": "hello"}}]
        assert requests[0].url.path.endswith("/getUpdates")
        assert json.loads(requests[0].content) == {
            "offset": 42,
            "timeout": 50,
            "allowed_updates": ["message", "my_chat_member"],
        }
        await gateway.get_updates(None, 80, ["message"])
        assert "offset" not in json.loads(requests[1].content)
        assert all(value >= 90 for value in requests[1].extensions["timeout"].values())


@pytest.mark.parametrize(
    ("status", "body", "error"),
    [
        (403, {"ok": False, "error_code": 403}, TelegramForbiddenError),
        (200, {"ok": False, "error_code": 403}, TelegramForbiddenError),
        (429, {"ok": False, "error_code": 429}, TelegramApiError),
        (500, {"ok": False}, TelegramApiError),
        (200, {"ok": False, "error_code": 400}, TelegramApiError),
        (200, [], TelegramApiError),
        (200, {"ok": True}, TelegramApiError),
    ],
)
async def test_http_gateway_classifies_errors(telegram_config, status, body, error):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status, json=body))
    ) as client:
        with pytest.raises(error):
            await HttpTelegramGateway(telegram_config, client).send_message(7, "hi")


@pytest.mark.parametrize("body", [None, {}, [7], [None], "updates"])
async def test_get_updates_rejects_malformed_result(telegram_config, body):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"ok": True, "result": body})
        )
    ) as client:
        with pytest.raises(TelegramApiError):
            await HttpTelegramGateway(telegram_config, client).get_updates(
                None, 50, ["message"]
            )


async def test_http_gateway_owned_client_cleanup_and_closed_lifetime(telegram_config):
    gateway = HttpTelegramGateway(telegram_config)
    await gateway.close()
    await gateway.close()
    with pytest.raises(TelegramApiError):
        await gateway.send_message(7, "closed")


@pytest.mark.parametrize(
    "failure", ["success", "forbidden", "server", "transport", "invalid-json"]
)
async def test_http_logs_and_tracebacks_never_expose_bot_token(
    telegram_config, caplog, failure
):
    caplog.set_level(logging.INFO, logger="httpx")
    for name in ("connection", "http11", "http2", "proxy", "socks"):
        caplog.set_level(logging.DEBUG, logger="httpcore." + name)

    def respond(request):
        # Reproduce httpcore's DEBUG trace of request/URL-bearing exceptions.
        for name in ("connection", "http11", "http2", "proxy", "socks"):
            logging.getLogger("httpcore." + name).debug("request=%s", request.url)
        if failure == "transport":
            raise httpx.ReadTimeout(str(request.url), request=request)
        if failure == "invalid-json":
            return httpx.Response(200, text=str(request.url))
        if failure in ("forbidden", "server"):
            status = 403 if failure == "forbidden" else 500
            return httpx.Response(
                status, json={"ok": False, "description": str(request.url)}
            )
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

    formatted_exception = ""
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = HttpTelegramGateway(telegram_config, client)
        try:
            await gateway.send_message(7, "hello")
        except TelegramApiError as error:
            formatted_exception = "".join(traceback.format_exception(error))
        assert bool(formatted_exception) == (failure != "success")
        await gateway.close()
    logging.getLogger("httpx").info("unrelated http request remains visible")
    assert "unrelated http request remains visible" in caplog.text
    safe = telegram_config["bot_token"] not in (caplog.text + formatted_exception)
    assert safe, "Formatted library logs and exception chain must hide credentials"


async def test_fake_records_messages_filters_updates_and_retries():
    gateway = FakeTelegramGateway()
    await gateway.send_message(
        7, "hello", reply_markup={"remove_keyboard": True}, protect_content=True
    )
    message = gateway.sent[0]
    assert (
        message.chat_id,
        message.text,
        message.reply_markup,
        message.protect_content,
    ) == (7, "hello", {"remove_keyboard": True}, True)
    gateway.forbidden_chat_ids.add(8)
    with pytest.raises(TelegramForbiddenError):
        await gateway.send_message(8, "blocked")
    assert len(gateway.sent) == 1
    gateway.updates = [
        {"update_id": 1, "message": {}},
        {"update_id": 2, "my_chat_member": {}},
        {"update_id": 3, "callback_query": {}},
    ]
    gateway.fail_next_get_updates = 2
    for _ in range(2):
        with pytest.raises(TelegramApiError):
            await gateway.get_updates(None, 50, ["message"])
    assert await gateway.get_updates(2, 50, ["message", "my_chat_member"]) == [
        {"update_id": 2, "my_chat_member": {}}
    ]
    assert await gateway.get_updates(None, 50, ["message"]) == [
        {"update_id": 1, "message": {}}
    ]
    await gateway.close()
