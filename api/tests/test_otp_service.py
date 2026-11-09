import asyncio
import importlib
import importlib.util
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import new as hmac_new
from secrets import randbelow, token_urlsafe

import httpx
import pytest
from otp_helpers import request_and_deliver, wait_for_delivery
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine

from eventopia import create_app
from eventopia.context.sqlite import SqliteConnector
from eventopia.exceptions import InvalidCodeError, RateLimitedError, ValidationError
from eventopia.models.auth import TelegramIdentityRecord
from eventopia.services.account import AccountService
from eventopia.services.auth import AuthService
from eventopia.sqls import accounts, telegram
from eventopia.sqls import otp as otp_sql
from eventopia.sqls.tables import accounts as account_table
from eventopia.sqls.tables import otp_challenges
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.telegram.gateway import TelegramApiError
from eventopia.views.auth import AuthView
from eventopia.wiring import Container, build_container


class Clock:
    def __init__(self):
        self.now = datetime(2030, 1, 1, tzinfo=UTC)

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)


def check(condition, message):
    # Never render codes, peppers, phone numbers or message payloads on failure.
    if not condition:
        pytest.fail(message, pytrace=False)


def phone():
    return "+99890" + f"{randbelow(10**7):07d}"


def service_class():
    if importlib.util.find_spec("eventopia.services.otp") is None:
        pytest.fail("OtpService is not implemented", pytrace=False)
    return importlib.import_module("eventopia.services.otp").OtpService


def texts_module():
    if importlib.util.find_spec("eventopia.telegram.texts") is None:
        pytest.fail("Telegram texts are not implemented", pytrace=False)
    return importlib.import_module("eventopia.telegram.texts")


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def auth_config(config):
    auth = config["auth"].copy()
    auth["otp_pepper"] = token_urlsafe(48)
    return auth


@pytest.fixture
def code():
    return f"{randbelow(10**6):06d}"


@pytest.fixture
def fake_telegram():
    return FakeTelegramGateway()


@pytest.fixture
def account_service(sqlite_connector, auth_config):
    # OTP operations use only AccountService's SQLite identity methods.
    return AccountService(None, sqlite_connector, auth_config)


@pytest.fixture
async def otp(
    sqlite_connector, fake_telegram, account_service, auth_config, clock, code
):
    service = service_class()(
        sqlite_connector,
        fake_telegram,
        account_service,
        auth_config,
        clock,
        lambda: code,
    )
    try:
        yield service
    finally:
        await service.close()


@pytest.fixture
async def registered(sqlite_connector, clock):
    identity = TelegramIdentityRecord(
        account_uid="u1",
        telegram_user_id=7,
        chat_id=7,
        phone_e164=phone(),
        phone_verified_at=clock(),
        username="tester",
        first_name="Test",
        last_name=None,
        language_code="ru",
        chat_active=True,
        chat_status_changed_at=clock(),
        updated_at=clock(),
    )
    async with sqlite_connector.session(write=True) as s:
        await accounts.insert_account(s, identity.account_uid, clock())
        await telegram.insert_identity(s, identity)
    return identity


async def challenge(sqlite, number, clock):
    async with sqlite.session() as s:
        return await otp_sql.select_open_challenge(s, number, clock())


async def test_registered_phone_gets_protected_code(
    otp, fake_telegram, registered, code, sqlite_connector, clock, auth_config
):
    number = registered.phone_e164
    check(
        await request_and_deliver(otp, number[4:], "1.1.1.1") == 60, "wrong retry delay"
    )
    assert len(fake_telegram.sent) == 1
    msg = fake_telegram.sent[0]
    assert msg.chat_id == 7 and msg.protect_content
    check(code in msg.text, "delivery lost code")
    check(code not in repr(msg), "fake message repr disclosed code")
    rec = await challenge(sqlite_connector, number, clock)
    assert rec.delivered and rec.account_uid == "u1" and rec.attempts == 0
    assert rec.expires_at == clock() + timedelta(seconds=300)
    expected = hmac_new(
        auth_config["otp_pepper"].encode(), f"{rec.id}:{code}".encode(), sha256
    ).hexdigest()
    check(rec.code_hash == expected, "stored digest is not challenge-bound HMAC")
    async with sqlite_connector.session() as s:
        rows = (await s.execute(select(otp_challenges))).mappings().all()
    check(code not in rows[0].values(), "raw code persisted")
    check(code not in repr(rec), "record repr disclosed code")


@pytest.mark.parametrize("state", ["unknown", "inactive", "unverified"])
async def test_ineligible_phone_same_response_no_delivery(
    otp, registered, fake_telegram, sqlite_connector, clock, state, code
):
    number = registered.phone_e164
    async with sqlite_connector.session(write=True) as s:
        if state == "inactive":
            await telegram.set_chat_active(s, 7, False, clock())
        elif state == "unverified":
            await telegram.set_identity_phone(s, 7, number, None, clock())
        else:
            number = phone()
    check(
        await request_and_deliver(otp, number, None) == 60,
        "different ineligible response",
    )
    assert fake_telegram.sent == []
    rec = await challenge(sqlite_connector, number, clock)
    assert rec is not None and rec.account_uid is None and not rec.delivered
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(number, code)


async def test_forbidden_marks_chat_inactive(
    otp, fake_telegram, registered, account_service, sqlite_connector, clock, code
):
    fake_telegram.forbidden_chat_ids.add(7)
    check(
        await request_and_deliver(otp, registered.phone_e164, None) == 60, "403 leaked"
    )
    assert not (await account_service.get_identity_by_telegram_id(7)).chat_active
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_network_error_same_response_and_unverifiable(
    otp, registered, monkeypatch, fake_telegram, sqlite_connector, clock, code, caplog
):
    async def fail(*args, **kwargs):
        raise TelegramApiError("upstream unavailable")

    monkeypatch.setattr(fake_telegram, "send_message", fail)
    check(
        await request_and_deliver(otp, registered.phone_e164, None) == 60,
        "network leaked",
    )
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    with pytest.raises(InvalidCodeError) as caught:
        await otp.verify_code(registered.phone_e164, code)
    check(
        code not in caplog.text + str(caught.value)
        and registered.phone_e164 not in caplog.text + str(caught.value),
        "failure disclosed private data",
    )


@pytest.mark.parametrize("known", [True, False])
async def test_resend_cooldown_is_precise(otp, registered, clock, known):
    number = registered.phone_e164 if known else phone()
    await request_and_deliver(otp, number, None)
    clock.advance(30.2)
    with pytest.raises(RateLimitedError) as caught:
        await request_and_deliver(otp, number, None)
    assert caught.value.retry_after == 30
    clock.advance(29.8)
    check(
        await request_and_deliver(otp, number, None) == 60,
        "exact resend boundary failed",
    )


@pytest.mark.parametrize("known", [True, False])
async def test_hourly_phone_limit_and_exact_reset(otp, registered, clock, known):
    number = registered.phone_e164 if known else phone()
    for _ in range(5):
        await request_and_deliver(otp, number, None)
        clock.advance(61)
    with pytest.raises(RateLimitedError) as caught:
        await request_and_deliver(otp, number, None)
    assert caught.value.retry_after == 3295
    clock.advance(3295)
    check(await request_and_deliver(otp, number, None) == 60, "hour boundary failed")


async def test_ip_limit_and_exact_reset(otp, clock):
    for _ in range(20):
        await request_and_deliver(otp, phone(), "1.1.1.1")
        clock.advance(2)
    with pytest.raises(RateLimitedError) as caught:
        await request_and_deliver(otp, phone(), "1.1.1.1")
    assert caught.value.retry_after == 3560
    clock.advance(3560)
    check(await request_and_deliver(otp, phone(), "1.1.1.1") == 60, "IP reset failed")


async def test_missing_ip_is_not_a_shared_quota(otp):
    for _ in range(21):
        check(
            await request_and_deliver(otp, phone(), None) == 60,
            "absent IP quota applied",
        )


async def test_quota_precedes_identity_lookup(
    otp, account_service, registered, monkeypatch, clock
):
    await request_and_deliver(otp, registered.phone_e164, None)

    async def unexpected(*args):
        pytest.fail("quota rejection queried identity", pytrace=False)

    monkeypatch.setattr(account_service, "get_active_identity_by_phone", unexpected)
    clock.advance(10)
    with pytest.raises(RateLimitedError) as caught:
        await request_and_deliver(otp, registered.phone_e164, None)
    assert caught.value.retry_after == 50


async def test_verify_consumes_once(otp, registered, code):
    await request_and_deliver(otp, registered.phone_e164, None)
    assert await otp.verify_code(registered.phone_e164, code) == "u1"
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_leading_zero_code(
    sqlite_connector, fake_telegram, account_service, auth_config, clock, registered
):
    code = "00" + f"{randbelow(10**4):04d}"
    service = service_class()(
        sqlite_connector,
        fake_telegram,
        account_service,
        auth_config,
        clock,
        lambda: code,
    )
    await request_and_deliver(service, registered.phone_e164, None)
    check(code in fake_telegram.sent[-1].text, "leading zero missing in delivery")
    assert await service.verify_code(registered.phone_e164, code) == "u1"


async def test_five_wrong_attempts_commit_and_kill(
    otp, registered, code, sqlite_connector, clock
):
    await request_and_deliver(otp, registered.phone_e164, None)
    wrong = f"{(int(code) + 1) % 10**6:06d}"
    for attempt in range(1, 6):
        with pytest.raises(InvalidCodeError):
            await otp.verify_code(registered.phone_e164, wrong)
        rec = await challenge(sqlite_connector, registered.phone_e164, clock)
        assert rec.attempts == attempt
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


@pytest.mark.parametrize("elapsed", [300, 301])
async def test_expired_code_fails(otp, registered, code, clock, elapsed):
    await request_and_deliver(otp, registered.phone_e164, None)
    clock.advance(elapsed)
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_new_request_supersedes_old(
    otp,
    registered,
    code,
    clock,
    sqlite_connector,
    fake_telegram,
    account_service,
    auth_config,
):
    await request_and_deliver(otp, registered.phone_e164, None)
    other = f"{(int(code) + 1) % 10**6:06d}"
    second = service_class()(
        sqlite_connector,
        fake_telegram,
        account_service,
        auth_config,
        clock,
        lambda: other,
    )
    clock.advance(61)
    await request_and_deliver(second, registered.phone_e164, None)
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)
    assert await second.verify_code(registered.phone_e164, other) == "u1"


@pytest.mark.parametrize("kind", ["unknown", "wrong", "malformed_phone", "bad_code"])
async def test_verification_errors_identical(otp, registered, code, kind):
    await request_and_deliver(otp, registered.phone_e164, None)
    number = phone() if kind == "unknown" else registered.phone_e164
    if kind == "malformed_phone":
        number = "not a phone"
    submitted = "invalid" if kind == "bad_code" else f"{(int(code) + 1) % 10**6:06d}"
    with pytest.raises(InvalidCodeError) as caught:
        await otp.verify_code(number, submitted)
    assert caught.value.code == 102
    assert caught.value.message == "Invalid or expired code"


async def test_invalid_request_writes_nothing(otp, sqlite_connector):
    with pytest.raises(ValidationError):
        await request_and_deliver(otp, "not a phone", None)
    async with sqlite_connector.session() as s:
        assert (await s.execute(select(otp_challenges))).first() is None


@pytest.mark.parametrize("state", ["new_owner", "unverified", "disabled"])
async def test_verify_checks_current_eligibility_inside_transaction(
    otp, registered, code, sqlite_connector, clock, state
):
    await request_and_deliver(otp, registered.phone_e164, None)
    async with sqlite_connector.session(write=True) as s:
        if state == "new_owner":
            await telegram.set_identity_phone(s, 7, None, None, clock())
            await accounts.insert_account(s, "u2", clock())
            await telegram.insert_identity(
                s,
                TelegramIdentityRecord(
                    account_uid="u2",
                    telegram_user_id=8,
                    chat_id=8,
                    phone_e164=registered.phone_e164,
                    phone_verified_at=clock(),
                    username=None,
                    first_name="Other",
                    last_name=None,
                    language_code="en",
                    chat_active=True,
                    chat_status_changed_at=clock(),
                    updated_at=clock(),
                ),
            )
        elif state == "unverified":
            await telegram.set_identity_phone(
                s, 7, registered.phone_e164, None, clock()
            )
        else:
            await s.execute(update(account_table).values(status="disabled"))
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_competing_verifies_only_one_consumes(
    otp,
    registered,
    code,
    sqlite_connector,
    fake_telegram,
    account_service,
    auth_config,
    clock,
    config,
):
    await request_and_deliver(otp, registered.phone_e164, None)
    other_sqlite = SqliteConnector({"path": config["sqlite"]["path"]})
    # sqlite_connector and config use the same tmp_path/auth.sqlite3 file.
    other = service_class()(
        other_sqlite, fake_telegram, account_service, auth_config, clock, lambda: code
    )
    try:
        outcomes = await asyncio.gather(
            *(
                service.verify_code(registered.phone_e164, code)
                for service in (otp, other, otp, other)
            ),
            return_exceptions=True,
        )
    finally:
        await other_sqlite.close()
    assert outcomes.count("u1") == 1
    assert sum(isinstance(out, InvalidCodeError) for out in outcomes) == 3


async def test_competing_requests_only_one_reserves(otp, registered, fake_telegram):
    outcomes = await asyncio.gather(
        *(request_and_deliver(otp, registered.phone_e164, None) for _ in range(20)),
        return_exceptions=True,
    )
    assert outcomes.count(60) == 1
    assert sum(isinstance(out, RateLimitedError) for out in outcomes) == 19
    assert len(fake_telegram.sent) == 1


async def test_send_outside_lock_and_pending_cannot_verify(
    otp, registered, code, fake_telegram, monkeypatch, sqlite_connector, clock
):
    entered, release = asyncio.Event(), asyncio.Event()
    original = fake_telegram.send_message

    async def paused(*args, **kwargs):
        entered.set()
        await release.wait()
        await original(*args, **kwargs)

    monkeypatch.setattr(fake_telegram, "send_message", paused)
    request = asyncio.create_task(request_and_deliver(otp, registered.phone_e164, None))
    try:
        await asyncio.wait_for(entered.wait(), timeout=2)
        with pytest.raises(InvalidCodeError):
            await asyncio.wait_for(
                otp.verify_code(registered.phone_e164, code), timeout=2
            )
        async with asyncio.timeout(2):
            async with sqlite_connector.session(write=True) as s:
                await accounts.insert_account(s, "unrelated", clock())
    finally:
        release.set()
        await request
    assert await otp.verify_code(registered.phone_e164, code) == "u1"


async def test_superseded_inflight_delivery_stays_invalid(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    clock,
    code,
    sqlite_connector,
    account_service,
    auth_config,
):
    entered, release = asyncio.Event(), asyncio.Event()
    original = fake_telegram.send_message

    async def paused(*args, **kwargs):
        entered.set()
        await release.wait()
        await original(*args, **kwargs)

    monkeypatch.setattr(fake_telegram, "send_message", paused)
    first = asyncio.create_task(request_and_deliver(otp, registered.phone_e164, None))
    try:
        await asyncio.wait_for(entered.wait(), timeout=2)
        clock.advance(61)
        monkeypatch.setattr(fake_telegram, "send_message", original)
        other_code = f"{(int(code) + 1) % 10**6:06d}"
        other = service_class()(
            sqlite_connector,
            fake_telegram,
            account_service,
            auth_config,
            clock,
            lambda: other_code,
        )
        await request_and_deliver(other, registered.phone_e164, None)
    finally:
        release.set()
        await first
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)
    assert await other.verify_code(registered.phone_e164, other_code) == "u1"


@pytest.mark.parametrize(
    ("language", "expected"),
    [("uz", "uz"), ("ru", "ru"), ("en", "en"), (None, "en"), ("fr", "en")],
)
def test_pick_language(language, expected):
    assert texts_module().pick_language(language) == expected


@pytest.mark.parametrize(
    ("language", "expiry", "warning", "ignore"),
    [
        ("uz", "daqiqa", "bermang", "so'ramagan"),
        ("ru", "минут", "сообщайте", "запрашивали"),
        ("en", "minutes", "share", "request"),
    ],
)
def test_messages_include_code_expiry_and_guidance(
    code, language, expiry, warning, ignore
):
    message = texts_module().otp_message(language, code, 5)
    check(code in message, "message missing code")
    check("5" in message and expiry in message, "message missing expiry")
    check(warning in message and ignore in message, "message missing guidance")


async def test_wiring_exposes_otp_service(config, fake_telegram, sqlite_connector):
    container = build_container(config, telegram=fake_telegram)
    try:
        service = getattr(container, "otp_service", None)
        assert service is not None
        check(
            await request_and_deliver(service, phone(), None) == 60,
            "wired service unusable",
        )
    finally:
        await container.close()


async def test_single_connection_pool_reuses_identity_session(
    sqlite_connector,
    registered,
    fake_telegram,
    auth_config,
    clock,
    code,
    monkeypatch,
    config,
):
    def bounded_engine(*args, **kwargs):
        return create_async_engine(
            *args, **kwargs, pool_size=1, max_overflow=0, pool_timeout=0.2
        )

    monkeypatch.setattr("eventopia.context.sqlite.create_async_engine", bounded_engine)
    bounded = SqliteConnector({"path": config["sqlite"]["path"]})
    account_service = AccountService(None, bounded, auth_config)
    service = service_class()(
        bounded, fake_telegram, account_service, auth_config, clock, lambda: code
    )
    try:
        check(
            await asyncio.wait_for(
                request_and_deliver(service, registered.phone_e164, None), timeout=2
            )
            == 60,
            "bounded pool could not reserve delivery",
        )
        assert await service.verify_code(registered.phone_e164, code) == "u1"
    finally:
        await bounded.close()


async def test_disabled_account_receives_code_but_cannot_verify(
    otp, registered, sqlite_connector, fake_telegram, code
):
    async with sqlite_connector.session(write=True) as s:
        await s.execute(update(account_table).values(status="disabled"))
    check(
        await request_and_deliver(otp, registered.phone_e164, None) == 60,
        "wrong response",
    )
    assert len(fake_telegram.sent) == 1
    check(code in fake_telegram.sent[0].text, "disabled identity missing delivery")
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_blocking_bot_after_delivery_does_not_invalidate_code(
    otp, registered, account_service, code
):
    await request_and_deliver(otp, registered.phone_e164, None)
    await account_service.set_chat_active(7, False)
    assert await otp.verify_code(registered.phone_e164, code) == "u1"


@pytest.mark.parametrize("outcome", ["success", "api_error", "timeout"])
async def test_http_completion_does_not_wait_for_telegram_delivery(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    account_service,
    auth_config,
    config,
    sqlite_connector,
    clock,
    code,
    outcome,
    caplog,
):
    entered, release = asyncio.Event(), asyncio.Event()
    original = fake_telegram.send_message
    private_marker = token_urlsafe(24)

    async def held(*args, **kwargs):
        entered.set()
        await release.wait()
        if outcome == "api_error":
            raise TelegramApiError(private_marker)
        if outcome == "timeout":
            raise TimeoutError(private_marker)
        await original(*args, **kwargs)

    monkeypatch.setattr(fake_telegram, "send_message", held)
    auth = AuthService(account_service, None, otp, config["telegram"], auth_config)
    app = create_app(Container(views=[AuthView(auth, auth_config)]))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        pending = asyncio.create_task(
            client.post("/api/auth/otp/request", json={"phone": registered.phone_e164})
        )
        try:
            await asyncio.wait_for(entered.wait(), timeout=2)
            unknown = await asyncio.wait_for(
                client.post("/api/auth/otp/request", json={"phone": phone()}), timeout=2
            )
            done, _ = await asyncio.wait({pending}, timeout=0.2)
            check(pending in done, "OTP HTTP response waits for Telegram delivery")
            response = pending.result()
            assert response.status_code == unknown.status_code == 200
            assert (
                response.json()["data"]
                == unknown.json()["data"]
                == {"retry_after_seconds": 60}
            )
            assert not (
                await challenge(sqlite_connector, registered.phone_e164, clock)
            ).delivered
            with pytest.raises(InvalidCodeError):
                await otp.verify_code(registered.phone_e164, code)
        finally:
            release.set()
            await asyncio.gather(pending, return_exceptions=True)
            await wait_for_delivery(otp)
    if outcome == "success":
        assert await otp.verify_code(registered.phone_e164, code) == "u1"
    else:
        with pytest.raises(InvalidCodeError):
            await otp.verify_code(registered.phone_e164, code)
    check(private_marker not in caplog.text, "delivery error exposed private details")


async def test_cancelled_shutdown_still_cancels_and_awaits_delivery(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
):
    entered, release, cancelled = asyncio.Event(), asyncio.Event(), asyncio.Event()

    async def held(*args, **kwargs):
        entered.set()
        try:
            await release.wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    monkeypatch.setattr(fake_telegram, "send_message", held)
    await otp.request_code(registered.phone_e164, None)
    await asyncio.wait_for(entered.wait(), timeout=2)
    shutdown = asyncio.create_task(otp.close())
    await asyncio.sleep(0)
    shutdown.cancel()
    try:
        with pytest.raises(asyncio.CancelledError):
            await shutdown
        assert cancelled.is_set(), "cancelled shutdown abandoned delivery work"
    finally:
        release.set()
        await wait_for_delivery(otp)


async def test_pending_delivery_is_bounded_and_overload_keeps_generic_quota(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    clock,
    sqlite_connector,
):
    monkeypatch.setattr("eventopia.services.otp._MAX_PENDING_DELIVERIES", 2)
    entered, release = asyncio.Queue(), asyncio.Event()
    sent = 0

    async def held(*args, **kwargs):
        nonlocal sent
        sent += 1
        entered.put_nowait(None)
        await release.wait()

    monkeypatch.setattr(fake_telegram, "send_message", held)
    try:
        for _ in range(2):
            check(
                await otp.request_code(registered.phone_e164, None) == 60,
                "bounded request changed response",
            )
            await asyncio.wait_for(entered.get(), timeout=2)
            clock.advance(61)
        check(
            await otp.request_code(registered.phone_e164, None) == 60,
            "overload changed known response",
        )
        check(
            await otp.request_code(phone(), None) == 60,
            "overload changed unknown response",
        )
        with pytest.raises(RateLimitedError):
            await otp.request_code(registered.phone_e164, None)
        assert sent == 2
        assert len(otp._deliveries) == 2
    finally:
        release.set()
        await wait_for_delivery(otp)
    latest = await challenge(sqlite_connector, registered.phone_e164, clock)
    assert not latest.delivered
    # Once capacity recovers, the next permitted request can be delivered again.
    clock.advance(61)
    await request_and_deliver(otp, registered.phone_e164, None)
    assert sent == 3
    assert (await challenge(sqlite_connector, registered.phone_e164, clock)).delivered


async def test_close_drains_success_and_stops_new_delivery(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    clock,
    sqlite_connector,
    code,
):
    entered, release = asyncio.Event(), asyncio.Event()
    original = fake_telegram.send_message

    async def held(*args, **kwargs):
        entered.set()
        await release.wait()
        await original(*args, **kwargs)

    monkeypatch.setattr(fake_telegram, "send_message", held)
    await otp.request_code(registered.phone_e164, None)
    await asyncio.wait_for(entered.wait(), timeout=2)
    closing = asyncio.create_task(otp.close())
    await asyncio.sleep(0)
    assert not closing.done()
    release.set()
    await asyncio.wait_for(closing, timeout=2)
    assert await otp.verify_code(registered.phone_e164, code) == "u1"
    clock.advance(61)
    check(
        await otp.request_code(registered.phone_e164, None) == 60,
        "closed service changed generic result",
    )
    await wait_for_delivery(otp)
    assert len(fake_telegram.sent) == 1
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    await otp.close()


async def test_close_cancels_stalled_delivery_after_grace(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    sqlite_connector,
    clock,
    code,
):
    monkeypatch.setattr("eventopia.services.otp._SHUTDOWN_GRACE_SECONDS", 0.01)
    entered, cancelled = asyncio.Event(), asyncio.Event()

    async def stalled(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    monkeypatch.setattr(fake_telegram, "send_message", stalled)
    await otp.request_code(registered.phone_e164, None)
    await asyncio.wait_for(entered.wait(), timeout=2)
    await asyncio.wait_for(otp.close(), timeout=1)
    assert cancelled.is_set()
    assert not otp._deliveries
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_delivery_deadline_ends_stalled_send_without_marking_delivered(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    sqlite_connector,
    clock,
    code,
):
    monkeypatch.setattr("eventopia.services.otp._DELIVERY_TIMEOUT_SECONDS", 0.01)
    cancelled = asyncio.Event()

    async def stalled(*args, **kwargs):
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    monkeypatch.setattr(fake_telegram, "send_message", stalled)
    check(
        await otp.request_code(registered.phone_e164, None) == 60,
        "deadline changed generic response",
    )
    await asyncio.wait_for(wait_for_delivery(otp), timeout=1)
    assert cancelled.is_set()
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_expired_inflight_delivery_is_never_marked_usable(
    otp,
    registered,
    fake_telegram,
    monkeypatch,
    clock,
    sqlite_connector,
    code,
):
    entered, release = asyncio.Event(), asyncio.Event()
    original = fake_telegram.send_message

    async def held(*args, **kwargs):
        entered.set()
        await release.wait()
        await original(*args, **kwargs)

    monkeypatch.setattr(fake_telegram, "send_message", held)
    await otp.request_code(registered.phone_e164, None)
    await asyncio.wait_for(entered.wait(), timeout=2)
    clock.advance(301)
    release.set()
    await wait_for_delivery(otp)
    async with sqlite_connector.session() as session:
        delivered = await session.scalar(select(otp_challenges.c.delivered))
    assert delivered is False
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)


async def test_unexpected_delivery_bookkeeping_error_is_private_and_unusable(
    otp,
    registered,
    monkeypatch,
    sqlite_connector,
    clock,
    code,
    caplog,
):
    private_marker = token_urlsafe(24)

    async def fail(*args, **kwargs):
        raise RuntimeError(private_marker)

    monkeypatch.setattr(otp_sql, "mark_delivered", fail)
    await request_and_deliver(otp, registered.phone_e164, None)
    assert not (
        await challenge(sqlite_connector, registered.phone_e164, clock)
    ).delivered
    with pytest.raises(InvalidCodeError):
        await otp.verify_code(registered.phone_e164, code)
    check(private_marker not in caplog.text, "bookkeeping error exposed private detail")
    assert "OTP delivery failed" in caplog.text


async def test_real_lifespan_drains_delivery_before_sqlite_and_gateway_close(
    otp,
    registered,
    fake_telegram,
    sqlite_connector,
    monkeypatch,
    clock,
):
    entered, release = asyncio.Event(), asyncio.Event()
    events = []
    original_send = fake_telegram.send_message
    original_close = sqlite_connector.close

    async def held(*args, **kwargs):
        entered.set()
        await release.wait()
        await original_send(*args, **kwargs)

    async def close_sqlite():
        if not sqlite_connector._closed:
            assert not otp._deliveries
            assert (
                await challenge(sqlite_connector, registered.phone_e164, clock)
            ).delivered
            events.append("sqlite")
        await original_close()

    async def close_gateway():
        assert not otp._deliveries
        events.append("gateway")

    monkeypatch.setattr(fake_telegram, "send_message", held)
    monkeypatch.setattr(sqlite_connector, "close", close_sqlite)
    monkeypatch.setattr(fake_telegram, "close", close_gateway)
    app = create_app(
        Container(
            views=[],
            otp_service=otp,
            sqlite=sqlite_connector,
            telegram=fake_telegram,
            _owns_telegram=True,
        )
    )

    async def run_lifespan():
        async with app.router.lifespan_context(app):
            await otp.request_code(registered.phone_e164, None)

    closing = asyncio.create_task(run_lifespan())
    try:
        await asyncio.wait_for(entered.wait(), timeout=2)
        assert events == []
    finally:
        release.set()
        await asyncio.wait_for(closing, timeout=2)
    assert events == ["sqlite", "gateway"]
