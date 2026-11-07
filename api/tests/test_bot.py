import asyncio
import importlib
import json
import logging
import os
import signal
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import update

from eventopia.models.auth import SharedContact, TelegramUser
from eventopia.services.account import AccountService
from eventopia.sqls import bot_state
from eventopia.sqls.tables import telegram_identities
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.telegram.gateway import TelegramApiError
from eventopia.telegram.http_gateway import HttpTelegramGateway


def feature(module, name):
    try:
        return getattr(importlib.import_module(module), name)
    except (ImportError, AttributeError):
        pytest.fail(f"Missing bot feature: {module}.{name}", pytrace=False)


@pytest.fixture
def account_service(neo4j_connector, sqlite_connector, config):
    return AccountService(neo4j_connector, sqlite_connector, config["auth"])


@pytest.fixture
def fake_telegram():
    return FakeTelegramGateway()


@pytest.fixture
def dispatcher(account_service, fake_telegram, config):
    return feature("eventopia.bot.dispatcher", "BotDispatcher")(
        account_service, fake_telegram, config["app"]
    )


@pytest.fixture
async def registered(account_service):
    return await account_service.register_from_contact(
        TelegramUser(7, "original", "Original", language_code="en"),
        SharedContact(7, "998901234567"),
        7,
    )


def message(text="/start", lang="en", **changes):
    value = {
        "message_id": 1,
        "date": 100,
        "chat": {"id": 7, "type": "private", "first_name": "New"},
        "from": {
            "id": 7,
            "is_bot": False,
            "first_name": "New",
            "last_name": "Name",
            "username": "new_name",
            "language_code": lang,
        },
        "text": text,
    }
    value.update(changes)
    return {"update_id": 41, "message": value}


def contact(owner=7, phone="998901234567", lang="en"):
    return message(
        lang=lang,
        contact={"user_id": owner, "phone_number": phone, "first_name": "New"},
    )


def membership(status, actor=7, kind="private"):
    return {
        "update_id": 42,
        "my_chat_member": {
            "chat": {"id": 7, "type": kind, "first_name": "New"},
            "from": {"id": actor, "is_bot": False, "first_name": "Actor"},
            "date": 100,
            "old_chat_member": {
                "status": "member",
                "user": {"id": 999, "is_bot": True},
            },
            "new_chat_member": {
                "status": status,
                "user": {"id": 999, "is_bot": True},
            },
        },
    }


def share_button(sent):
    markup = sent.reply_markup
    assert markup["keyboard"][0][0]["request_contact"] is True
    assert markup["keyboard"][0][0]["text"]
    assert markup["one_time_keyboard"] is True and markup["resize_keyboard"] is True


@pytest.mark.parametrize("text", ["/start", "hello", "/help", "/phone"])
async def test_unregistered_messages_prompt_for_own_contact(
    dispatcher, fake_telegram, text
):
    await dispatcher.handle_update(message(text))
    share_button(fake_telegram.sent[-1])
    assert fake_telegram.sent[-1].chat_id == 7


async def test_own_contact_registers_removes_keyboard_and_links_login(
    dispatcher, fake_telegram, account_service, config
):
    await dispatcher.handle_update(contact())
    sent = fake_telegram.sent[-1]
    assert sent.reply_markup == {"remove_keyboard": True}
    assert config["app"]["public_base_url"].rstrip("/") + "/login" in sent.text
    identity = await account_service.get_identity_by_telegram_id(7)
    if identity.phone_e164 != "+998901234567":
        pytest.fail("Contact phone was not normalized", pytrace=False)
    assert identity.phone_verified_at and identity.chat_active


@pytest.mark.parametrize("owner", [8, None])
async def test_foreign_contact_refused_without_identity(
    dispatcher, fake_telegram, account_service, owner
):
    await dispatcher.handle_update(contact(owner))
    assert await account_service.get_identity_by_telegram_id(7) is None
    assert "own" in fake_telegram.sent[-1].text.lower()


async def test_registered_start_masks_phone_and_offers_change(
    dispatcher, fake_telegram, registered
):
    await dispatcher.handle_update(message())
    sent = fake_telegram.sent[-1]
    assert "@original" in sent.text and "+998 90 *** 4567" in sent.text
    assert "/phone" in sent.text
    if "998901234567" in sent.text:
        pytest.fail("Unmasked phone in reply", pytrace=False)


async def test_phone_command_changes_phone_for_same_account(
    dispatcher, fake_telegram, account_service, registered
):
    await dispatcher.handle_update(message("/phone"))
    share_button(fake_telegram.sent[-1])
    await dispatcher.handle_update(contact(phone="998901234568"))
    identity = await account_service.get_identity_by_telegram_id(7)
    assert identity.account_uid == registered.uid
    if identity.phone_e164 != "+998901234568":
        pytest.fail("Phone command did not change phone", pytrace=False)


async def test_message_refreshes_names_language_and_reactivates(
    dispatcher, account_service, registered
):
    await account_service.set_chat_active(7, False)
    await dispatcher.handle_update(message("hello", lang="uz"))
    identity = await account_service.get_identity_by_telegram_id(7)
    assert identity.chat_active
    assert (identity.username, identity.first_name, identity.last_name) == (
        "new_name",
        "New",
        "Name",
    )
    assert identity.language_code == "uz"


async def test_unverified_identity_still_gets_share_button(
    dispatcher, fake_telegram, sqlite_connector, registered
):
    async with sqlite_connector.session(write=True) as s:
        await s.execute(update(telegram_identities).values(phone_verified_at=None))
    await dispatcher.handle_update(message())
    share_button(fake_telegram.sent[-1])


@pytest.mark.parametrize("kind", ["group", "supergroup", "channel"])
async def test_non_private_messages_ignore_contacts_and_names(
    dispatcher, fake_telegram, account_service, registered, kind
):
    upd = contact()
    upd["message"]["chat"]["type"] = kind
    await dispatcher.handle_update(upd)
    assert not fake_telegram.sent
    assert (await account_service.get_identity_by_telegram_id(7)).username == "original"


async def test_contact_must_match_sender_not_private_chat_id(
    dispatcher, fake_telegram, account_service
):
    upd = contact(owner=7)
    upd["message"]["from"]["id"] = 8
    await dispatcher.handle_update(upd)
    assert await account_service.get_identity_by_telegram_id(8) is None
    assert "own" in fake_telegram.sent[-1].text.lower()


async def test_membership_uses_private_chat_identity_not_bot_or_actor(
    dispatcher, account_service, registered
):
    await dispatcher.handle_update(membership("kicked", actor=88))
    assert not (await account_service.get_identity_by_telegram_id(7)).chat_active
    await dispatcher.handle_update(membership("member", actor=88))
    assert (await account_service.get_identity_by_telegram_id(7)).chat_active
    assert await account_service.get_identity_by_telegram_id(999) is None
    assert (await account_service.get_identity_by_telegram_id(7)).username == "original"


async def test_group_membership_and_unrelated_status_do_not_change_state(
    dispatcher, account_service, registered
):
    await dispatcher.handle_update(membership("kicked", kind="group"))
    assert (await account_service.get_identity_by_telegram_id(7)).chat_active
    await account_service.set_chat_active(7, False)
    await dispatcher.handle_update(membership("administrator"))
    assert not (await account_service.get_identity_by_telegram_id(7)).chat_active


@pytest.mark.parametrize(
    ("lang", "word"),
    [
        ("uz", "telefon"),
        ("ru", "телефон"),
        ("en", "phone"),
        ("fr", "phone"),
        (None, "phone"),
    ],
)
async def test_language_selection(dispatcher, fake_telegram, lang, word):
    await dispatcher.handle_update(message(lang=lang))
    assert word in fake_telegram.sent[-1].text.lower()
    assert word in fake_telegram.sent[-1].reply_markup["keyboard"][0][0]["text"].lower()


@pytest.mark.parametrize("lang", ["uz", "ru", "en"])
async def test_localized_registration_help_and_phone_prompt(
    dispatcher, fake_telegram, lang
):
    await dispatcher.handle_update(contact(lang=lang))
    assert "/login" in fake_telegram.sent[-1].text
    await dispatcher.handle_update(message("/help", lang=lang))
    assert "/phone" in fake_telegram.sent[-1].text
    await dispatcher.handle_update(message("/phone", lang=lang))
    share_button(fake_telegram.sent[-1])
    if lang == "ru":
        assert any("\u0400" <= char <= "\u04ff" for char in fake_telegram.sent[-1].text)


async def offset(sqlite):
    async with sqlite.session() as s:
        return await bot_state.get_value(s, "getUpdates.offset")


class RecordingDispatcher:
    def __init__(self, sqlite):
        self.sqlite = sqlite
        self.seen = []
        self.before = []
        self.fail_ids = set()

    async def handle_update(self, upd):
        self.before.append(await offset(self.sqlite))
        self.seen.append(upd["update_id"])
        if upd["update_id"] in self.fail_ids:
            raise ValueError("sensitive-sentinel-payload")


@pytest.fixture
def poller_setup(sqlite_connector, fake_telegram, config):
    dispatcher = RecordingDispatcher(sqlite_connector)
    sleeps = []

    async def sleep(seconds):
        sleeps.append(seconds)

    poller = feature("eventopia.bot.poller", "BotPoller")(
        dispatcher, fake_telegram, sqlite_connector, config["telegram"], sleep=sleep
    )
    return poller, dispatcher, sleeps


async def test_poller_persists_each_offset_and_restart_does_not_replay(
    poller_setup, fake_telegram, sqlite_connector, config
):
    poller, dispatcher, _ = poller_setup
    fake_telegram.updates = [message(), {**message(), "update_id": 42}]
    assert await poller.run_once() == 2
    assert dispatcher.before == [None, "42"]
    assert await offset(sqlite_connector) == "43"
    restarted = feature("eventopia.bot.poller", "BotPoller")(
        dispatcher, fake_telegram, sqlite_connector, config["telegram"]
    )
    assert await restarted.run_once() == 0
    assert dispatcher.seen == [41, 42]


async def test_polling_failure_does_not_advance_and_backoff_caps_and_resets(
    poller_setup, fake_telegram, sqlite_connector
):
    poller, dispatcher, sleeps = poller_setup
    fake_telegram.fail_next_get_updates = 7
    fake_telegram.updates = [message()]
    for _ in range(7):
        assert await poller.run_once() == 0
        assert await offset(sqlite_connector) is None
    assert sleeps == [1, 2, 4, 8, 16, 30, 30]
    assert await poller.run_once() == 1
    fake_telegram.fail_next_get_updates = 1
    assert await poller.run_once() == 0
    assert sleeps[-1] == 1
    assert dispatcher.seen == [41]


async def test_handler_exception_skips_bad_update_and_logs_only_safe_metadata(
    poller_setup, fake_telegram, sqlite_connector, caplog
):
    poller, dispatcher, _ = poller_setup
    dispatcher.fail_ids.add(41)
    fake_telegram.updates = [message(), {**message(), "update_id": 42}]
    with caplog.at_level(logging.WARNING):
        assert await poller.run_once() == 2
    assert dispatcher.seen == [41, 42] and dispatcher.before == [None, "42"]
    assert await offset(sqlite_connector) == "43"
    assert "41" in caplog.text and "ValueError" in caplog.text
    assert "sensitive-sentinel-payload" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


async def test_poller_sends_configured_api_parameters_and_sanitizes_errors(
    sqlite_connector, config, caplog
):
    requests = []

    def respond(request):
        requests.append(json.loads(request.content))
        raise httpx.ReadTimeout("sensitive-sentinel-payload", request=request)

    async def sleep(seconds):
        pass

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = HttpTelegramGateway(config["telegram"], client)
        poller = feature("eventopia.bot.poller", "BotPoller")(
            RecordingDispatcher(sqlite_connector),
            gateway,
            sqlite_connector,
            config["telegram"],
            sleep=sleep,
        )
        with caplog.at_level(logging.DEBUG):
            assert await poller.run_once() == 0
    assert requests == [
        {
            "timeout": config["telegram"]["poll_timeout_seconds"],
            "allowed_updates": ["message", "my_chat_member"],
        }
    ]
    assert await offset(sqlite_connector) is None
    assert "sensitive-sentinel-payload" not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


async def test_run_forever_repeats_and_cancellation_propagates(
    poller_setup, fake_telegram
):
    poller, dispatcher, _ = poller_setup
    ready = asyncio.Event()
    calls = 0
    original = fake_telegram.get_updates

    async def updates(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            ready.set()
            await asyncio.Event().wait()
        return await original(*args, **kwargs)

    fake_telegram.updates = [message()]
    fake_telegram.get_updates = updates
    task = asyncio.create_task(poller.run_forever())
    await asyncio.wait_for(ready.wait(), 5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert dispatcher.seen == [41] and calls == 2


async def test_delete_webhook_gateway_payload_fake_and_errors(config):
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"ok": True, "result": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = HttpTelegramGateway(config["telegram"], client)
        await feature(
            "eventopia.telegram.http_gateway", "HttpTelegramGateway"
        ).delete_webhook(gateway)
    assert calls[0].url.path.endswith("/deleteWebhook")
    assert json.loads(calls[0].content) == {}
    fake = FakeTelegramGateway()
    await fake.delete_webhook()
    assert fake.webhook_deleted


async def test_bot_wiring_builds_subset_and_closes_owned_resources(config):
    container = feature("eventopia.wiring", "build_bot_container")(config)
    assert container.views == []
    assert container.session_service is None and container.otp_service is None
    assert container.auth_service is None
    assert isinstance(container.account_service, AccountService)
    assert isinstance(container.poller, feature("eventopia.bot.poller", "BotPoller"))
    await container.close()
    assert not await container.sqlite.ping()
    with pytest.raises(TelegramApiError):
        await container.telegram.send_message(7, "closed")


async def test_main_deletes_webhook_and_closes_on_startup_error(monkeypatch, config):
    main = feature("bot_main", "main")
    module = importlib.import_module("bot_main")
    gateway = FakeTelegramGateway()
    closed = []

    async def fail():
        assert gateway.webhook_deleted
        raise RuntimeError("synthetic startup failure")

    async def close():
        closed.append(True)

    container = SimpleNamespace(
        telegram=gateway, poller=SimpleNamespace(run_forever=fail), close=close
    )
    monkeypatch.setattr(module, "load_config", lambda path: config)
    monkeypatch.setattr(module, "build_bot_container", lambda cfg: container)
    with pytest.raises(RuntimeError, match="synthetic startup failure"):
        await main()
    assert closed == [True]


async def test_entrypoint_sigterm_cancels_polling_and_closes_resources(tmp_path):
    feature("bot_main", "main")
    script = """
import asyncio
from pathlib import Path
from types import SimpleNamespace
import bot_main
root = Path(__import__('sys').argv[1])
async def delete():
    (root / 'deleted').touch()
async def poll():
    (root / 'ready').touch()
    try:
        await asyncio.Event().wait()
    finally:
        (root / 'cancelled').touch()
async def close():
    (root / 'closed').touch()
bot_main.load_config = lambda path: {}
bot_main.build_bot_container = lambda cfg: SimpleNamespace(
    telegram=SimpleNamespace(delete_webhook=delete),
    poller=SimpleNamespace(run_forever=poll), close=close)
asyncio.run(bot_main.main())
"""
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-c",
        script,
        str(tmp_path),
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        async with asyncio.timeout(10):
            while not (tmp_path / "ready").exists():
                if process.returncode is not None:
                    pytest.fail("Bot subprocess exited before polling", pytrace=False)
                await asyncio.sleep(0.02)
        process.send_signal(signal.SIGTERM)
        await asyncio.wait_for(process.communicate(), 10)
        assert process.returncode == 0
        assert all(
            (tmp_path / name).exists()
            for name in (
                "deleted",
                "cancelled",
                "closed",
            )
        )
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


@pytest.mark.parametrize("result", [False, None, {}, "true"])
async def test_delete_webhook_rejects_unsuccessful_result(config, result):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"ok": True, "result": result})
        )
    ) as client:
        gateway = HttpTelegramGateway(config["telegram"], client)
        method = feature("eventopia.telegram.http_gateway", "HttpTelegramGateway")
        with pytest.raises(TelegramApiError):
            await method.delete_webhook(gateway)


async def test_bot_startup_and_shutdown_logging_is_secret_safe(config, caplog):
    config["app"]["log_level"] = "DEBUG"
    values = [
        config["telegram"]["bot_token"],
        config["neo4j"]["password"],
        config["auth"]["jwt_secret"],
        config["auth"]["otp_pepper"],
    ]
    container = feature("eventopia.wiring", "build_bot_container")(config)
    await container.close()
    if any(value in caplog.text for value in values):
        pytest.fail("Bot lifecycle log exposed a secret", pytrace=False)


async def test_offset_commit_failure_stops_batch_before_next_update(
    poller_setup, fake_telegram, sqlite_connector, monkeypatch
):
    poller, dispatcher, _ = poller_setup
    fake_telegram.updates = [message(), {**message(), "update_id": 42}]

    async def fail(*args):
        raise RuntimeError("synthetic state storage failure")

    monkeypatch.setattr(bot_state, "set_value", fail)
    with pytest.raises(RuntimeError, match="synthetic state storage failure"):
        await poller.run_once()
    assert dispatcher.seen == [41]
    assert await offset(sqlite_connector) is None


async def test_contact_registration_under_debug_never_logs_phone(
    dispatcher, fake_telegram, account_service, caplog
):
    from eventopia.context.request_id import configure_logging

    caplog.set_level(logging.DEBUG)
    configure_logging("DEBUG")
    caplog.clear()
    await dispatcher.handle_update(contact())
    identity = await account_service.get_identity_by_telegram_id(7)
    assert identity.phone_verified_at is not None
    assert fake_telegram.sent[-1].reply_markup == {"remove_keyboard": True}
    logging.getLogger("eventopia.test").debug("application debug remains available")
    assert "application debug remains available" in caplog.text
    if any(value in caplog.text for value in ("998901234567", "+998901234567")):
        pytest.fail("DEBUG contact registration exposed a full phone", pytrace=False)
