import asyncio
import importlib
import importlib.util
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

import jwt
import pytest
from sqlalchemy import func, select

from eventopia.exceptions import AuthError
from eventopia.sqls import accounts, sessions
from eventopia.sqls.tables import refresh_sessions
from eventopia.wiring import build_container


class Clock:
    def __init__(self):
        self.now = datetime(2030, 1, 1, tzinfo=UTC)

    def __call__(self):
        return self.now

    def advance(self, **kwargs):
        self.now += timedelta(**kwargs)


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def auth_config(config):
    auth = config["auth"].copy()
    auth["jwt_secret"] = token_urlsafe(48)
    return auth


@pytest.fixture
def session_service(sqlite_connector, auth_config, clock):
    if importlib.util.find_spec("eventopia.services.session") is None:
        pytest.fail("SessionService is not implemented", pytrace=False)
    cls = importlib.import_module("eventopia.services.session").SessionService
    return cls(sqlite_connector, auth_config, clock)


@pytest.fixture(autouse=True)
async def account(sqlite_connector, clock):
    async with sqlite_connector.session(write=True) as s:
        await accounts.insert_account(s, "u1", clock())


def check(condition, message):
    # Keep generated credentials out of assertion rewriting on regressions.
    if not condition:
        pytest.fail(message, pytrace=False)


async def record(sqlite, raw):
    async with sqlite.session() as s:
        return await sessions.select_session_by_hash(
            s, sha256(raw.encode()).hexdigest()
        )


def test_access_token_roundtrip_and_expiry(session_service, clock, auth_config):
    token = session_service.issue_access_token("u1", "ali")
    claims = session_service.verify_access_token(token)
    assert (claims.uid, claims.username) == ("u1", "ali")
    payload = jwt.decode(
        token,
        auth_config["jwt_secret"],
        algorithms=["HS256"],
        options={"verify_exp": False, "verify_iat": False},
    )
    assert payload["typ"] == "access"
    assert payload["iat"] == int(clock().timestamp())
    assert payload["exp"] - payload["iat"] == 900
    clock.advance(seconds=899)
    assert session_service.verify_access_token(token).uid == "u1"
    clock.advance(seconds=1)
    with pytest.raises(AuthError):
        session_service.verify_access_token(token)


@pytest.mark.parametrize("missing", ["sub", "username", "typ", "iat", "exp"])
def test_access_requires_claims(session_service, auth_config, clock, missing):
    payload = dict(
        sub="u1",
        username="ali",
        typ="access",
        iat=int(clock().timestamp()),
        exp=int(clock().timestamp()) + 900,
    )
    del payload[missing]
    token = jwt.encode(payload, auth_config["jwt_secret"], algorithm="HS256")
    with pytest.raises(AuthError):
        session_service.verify_access_token(token)


@pytest.mark.parametrize(
    "change",
    [
        {"typ": "refresh"},
        {"sub": 1},
        {"sub": ""},
        {"username": None},
        {"iat": "bad"},
        {"exp": "bad"},
        {"exp": True},
        {"iat": 1893456001},
        {"exp": 1893456000},
    ],
)
def test_access_rejects_invalid_claims(session_service, auth_config, clock, change):
    payload = dict(
        sub="u1",
        username="ali",
        typ="access",
        iat=int(clock().timestamp()),
        exp=int(clock().timestamp()) + 900,
    )
    payload.update(change)
    token = jwt.encode(payload, auth_config["jwt_secret"], algorithm="HS256")
    with pytest.raises(AuthError):
        session_service.verify_access_token(token)


@pytest.mark.parametrize("kind", ["signature", "algorithm", "malformed"])
def test_access_rejects_bad_token_without_disclosing_it(
    session_service, auth_config, clock, kind, caplog
):
    payload = dict(
        sub="u1",
        username="ali",
        typ="access",
        iat=int(clock().timestamp()),
        exp=int(clock().timestamp()) + 900,
    )
    token = jwt.encode(
        payload,
        token_urlsafe(48) if kind == "signature" else auth_config["jwt_secret"],
        algorithm="HS384" if kind == "algorithm" else "HS256",
    )
    if kind == "malformed":
        token = token_urlsafe(32)
    with pytest.raises(AuthError) as caught:
        session_service.verify_access_token(token)
    check(
        token not in str(caught.value) + repr(caught.value) + caplog.text,
        "credential appeared in error or logs",
    )


async def test_create_stores_only_hash_and_starts_distinct_families(
    session_service, sqlite_connector, clock
):
    first = await session_service.create_refresh("u1", "ua", "1.2.3.4")
    second = await session_service.create_refresh("u1", None, None)
    rec = await record(sqlite_connector, first)
    other = await record(sqlite_connector, second)
    assert rec.account_uid == "u1" and rec.user_agent == "ua" and rec.ip == "1.2.3.4"
    assert rec.issued_at == clock() and rec.expires_at == clock() + timedelta(days=30)
    assert rec.family_id != other.family_id
    check(len(first) >= 43 and first != second, "opaque credentials are not distinct")
    check(
        first not in repr(rec) and rec.token_hash not in repr(rec),
        "credential appeared in record repr",
    )
    async with sqlite_connector.session() as s:
        rows = (await s.execute(select(refresh_sessions))).mappings().all()
    check(
        all(first not in str(row) and second not in str(row) for row in rows),
        "raw credential persisted",
    )


async def test_rotate_returns_new_token_and_revokes_old(
    session_service, sqlite_connector
):
    raw = await session_service.create_refresh("u1", "ua", "1.2.3.4")
    out = await session_service.rotate_refresh(raw)
    assert out.uid == "u1"
    check(
        bool(out.new_refresh_token) and out.new_refresh_token != raw,
        "rotation did not replace credential",
    )
    old = await record(sqlite_connector, raw)
    new = await record(sqlite_connector, out.new_refresh_token)
    assert old.revoked_at is not None and old.replaced_by == new.id
    assert old.family_id == new.family_id and new.revoked_at is None
    assert new.user_agent == "ua" and new.ip == "1.2.3.4"
    check(out.new_refresh_token not in repr(out), "credential appeared in outcome repr")


@pytest.mark.parametrize("seconds", [0, 29, 30])
async def test_reuse_within_grace_is_tolerated(session_service, clock, seconds):
    raw = await session_service.create_refresh("u1", None, None)
    await session_service.rotate_refresh(raw)
    clock.advance(seconds=seconds)
    out = await session_service.rotate_refresh(raw)
    assert out.uid == "u1" and out.new_refresh_token is None


async def test_reuse_after_grace_revokes_family_and_commits(
    session_service, sqlite_connector, clock
):
    raw = await session_service.create_refresh("u1", None, None)
    other = await session_service.create_refresh("u1", None, None)
    new = (await session_service.rotate_refresh(raw)).new_refresh_token
    clock.advance(seconds=31)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(raw)
    assert (await record(sqlite_connector, new)).revoked_at is not None
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(new)
    assert (await session_service.rotate_refresh(other)).uid == "u1"


async def test_expired_refresh_rejected(session_service, clock):
    raw = await session_service.create_refresh("u1", None, None)
    clock.advance(days=30)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(raw)


async def test_unknown_refresh_rejected_and_revoke_is_idempotent(session_service):
    raw = token_urlsafe(32)
    await session_service.revoke_refresh(None)
    await session_service.revoke_refresh(raw)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(raw)


async def test_revoke_then_rotate_fails_even_within_grace(session_service):
    raw = await session_service.create_refresh("u1", None, None)
    await session_service.revoke_refresh(raw)
    await session_service.revoke_refresh(raw)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(raw)


@pytest.mark.parametrize("cause", ["family", "account", "logout_current"])
async def test_grace_cannot_survive_revocation(
    session_service, sqlite_connector, clock, cause
):
    raw = await session_service.create_refresh("u1", None, None)
    other = await session_service.create_refresh("u1", None, None)
    new = (await session_service.rotate_refresh(raw)).new_refresh_token
    # A second rotation checks propagation beyond the immediate replacement.
    newest = (await session_service.rotate_refresh(new)).new_refresh_token
    if cause.startswith("logout"):
        await session_service.revoke_refresh(newest)
    else:
        async with sqlite_connector.session(write=True) as s:
            if cause == "account":
                await sessions.revoke_all_for_account(s, "u1", clock())
            else:
                rec = await sessions.select_session_by_hash(
                    s, sha256(raw.encode()).hexdigest()
                )
                await sessions.revoke_family(s, rec.family_id, clock())
    for token in (raw, new, newest):
        with pytest.raises(AuthError):
            await session_service.rotate_refresh(token)
    if cause != "account":
        assert (await session_service.rotate_refresh(other)).uid == "u1"


async def test_grace_allows_multiple_live_descendants(session_service):
    raw = await session_service.create_refresh("u1", None, None)
    new = (await session_service.rotate_refresh(raw)).new_refresh_token
    newest = (await session_service.rotate_refresh(new)).new_refresh_token
    assert (await session_service.rotate_refresh(raw)).new_refresh_token is None
    assert (await session_service.rotate_refresh(new)).new_refresh_token is None
    assert (await session_service.rotate_refresh(newest)).uid == "u1"


async def test_simultaneous_rotation_serializes_tabs(session_service, sqlite_connector):
    raw = await session_service.create_refresh("u1", None, None)
    outcomes = await asyncio.gather(
        *(session_service.rotate_refresh(raw) for _ in range(5))
    )
    assert all(out.uid == "u1" for out in outcomes)
    assert sum(out.new_refresh_token is not None for out in outcomes) == 1
    async with sqlite_connector.session() as s:
        assert (
            await s.execute(select(func.count()).select_from(refresh_sessions))
        ).scalar() == 2
    new = next(
        out.new_refresh_token for out in outcomes if out.new_refresh_token is not None
    )
    assert (await session_service.rotate_refresh(new)).uid == "u1"


async def test_wiring_exposes_session_service(config):
    config["auth"]["jwt_secret"] = token_urlsafe(48)
    container = build_container(config)
    try:
        service = getattr(container, "session_service", None)
        assert service is not None
        token = service.issue_access_token("u1", "ali")
        assert service.verify_access_token(token).uid == "u1"
    finally:
        await container.close()


async def test_logout_stale_cookie_revokes_only_its_refresh_family(session_service):
    raw = await session_service.create_refresh("u1", None, None)
    other = await session_service.create_refresh("u1", None, None)
    new = (await session_service.rotate_refresh(raw)).new_refresh_token
    newest = (await session_service.rotate_refresh(new)).new_refresh_token
    await session_service.revoke_refresh(raw)
    for credential in (raw, new, newest):
        with pytest.raises(AuthError):
            await session_service.rotate_refresh(credential)
    assert (await session_service.rotate_refresh(other)).uid == "u1"


async def test_expired_predecessor_reuse_still_revokes_live_family(
    session_service, clock
):
    raw = await session_service.create_refresh("u1", None, None)
    clock.advance(days=29)
    new = (await session_service.rotate_refresh(raw)).new_refresh_token
    clock.advance(days=2)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(raw)
    with pytest.raises(AuthError):
        await session_service.rotate_refresh(new)
