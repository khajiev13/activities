import asyncio
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from secrets import token_hex

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from eventopia import create_app
from eventopia.wiring import build_container

NOW = datetime(2026, 11, 7, 12, tzinfo=UTC)
PHONE = "+998900000001"


def identity(uid="a", tg_id=1, phone=PHONE):
    from eventopia.models.auth import TelegramIdentityRecord

    return TelegramIdentityRecord(
        account_uid=uid,
        telegram_user_id=tg_id,
        chat_id=tg_id,
        phone_e164=phone,
        phone_verified_at=NOW if phone else None,
        username="user",
        first_name="First",
        last_name=None,
        language_code="en",
        chat_active=True,
        chat_status_changed_at=NOW,
        updated_at=NOW,
    )


def challenge(id="c", **changes):
    from eventopia.models.auth import OtpChallengeRecord

    return replace(
        OtpChallengeRecord(
            id=id,
            phone_e164=PHONE,
            account_uid="a",
            code_hash=token_hex(32),
            created_at=NOW,
            expires_at=NOW + timedelta(minutes=5),
            attempts=0,
            consumed_at=None,
            superseded_at=None,
            requester_ip="192.0.2.1",
            delivered=True,
        ),
        **changes,
    )


def refresh(id="s", family="f", account="a", **changes):
    from eventopia.models.auth import RefreshSessionRecord

    return replace(
        RefreshSessionRecord(
            id=id,
            account_uid=account,
            family_id=family,
            token_hash=token_hex(32),
            issued_at=NOW,
            expires_at=NOW + timedelta(days=30),
            revoked_at=None,
            replaced_by=None,
            user_agent=None,
            ip="192.0.2.1",
        ),
        **changes,
    )


async def test_wal_and_foreign_keys_on_each_connection(sqlite_connector):
    async with sqlite_connector.session() as first:
        async with sqlite_connector.session() as second:
            for session in (first, second):
                assert (
                    await session.execute(text("PRAGMA journal_mode"))
                ).scalar() == "wal"
                assert (
                    await session.execute(text("PRAGMA foreign_keys"))
                ).scalar() == 1
                assert (
                    await session.execute(text("PRAGMA busy_timeout"))
                ).scalar() == 5000


async def test_account_commit_and_utc_roundtrip(sqlite_connector):
    from eventopia.sqls import accounts

    local = NOW.astimezone(timezone(timedelta(hours=5)))
    async with sqlite_connector.session() as s:
        assert await accounts.select_account(s, "missing") is None
        await accounts.insert_account(s, "a", local)
    async with sqlite_connector.session() as s:
        rec = await accounts.select_account(s, "a")
        assert (rec.uid, rec.status, rec.created_at) == ("a", "active", NOW)
        assert rec.created_at.tzinfo is UTC


async def test_session_rolls_back_all_writes_on_exception(sqlite_connector):
    from eventopia.sqls import accounts

    with pytest.raises(RuntimeError):
        async with sqlite_connector.session() as s:
            await accounts.insert_account(s, "a", NOW)
            raise RuntimeError("abort transaction")
    async with sqlite_connector.session() as s:
        assert await accounts.select_account(s, "a") is None


async def test_integrity_failure_rolls_back_prior_writes(sqlite_connector):
    from eventopia.sqls import accounts, telegram

    with pytest.raises(IntegrityError):
        async with sqlite_connector.session() as s:
            await accounts.insert_account(s, "a", NOW)
            await telegram.insert_identity(s, identity(uid="missing"))
    async with sqlite_connector.session() as s:
        assert await accounts.select_account(s, "a") is None


@pytest.mark.parametrize("field", ["phone", "telegram_id", "account"])
async def test_identity_uniqueness(sqlite_connector, field):
    from eventopia.sqls import accounts, telegram

    async with sqlite_connector.session() as s:
        await accounts.insert_account(s, "a", NOW)
        await accounts.insert_account(s, "b", NOW)
        await telegram.insert_identity(s, identity())
    rec = identity(
        uid="a" if field == "account" else "b",
        tg_id=1 if field == "telegram_id" else 2,
        phone=PHONE if field == "phone" else None,
    )
    with pytest.raises(IntegrityError):
        async with sqlite_connector.session() as s:
            await telegram.insert_identity(s, rec)


async def test_identity_queries_profile_phone_and_chat_updates(sqlite_connector):
    from eventopia.sqls import accounts, telegram

    async with sqlite_connector.session() as s:
        await accounts.insert_account(s, "a", NOW)
        await accounts.insert_account(s, "b", NOW)
        await telegram.insert_identity(s, identity())
        await telegram.insert_identity(s, identity("b", 2, None))
        assert await telegram.select_identity_by_telegram_id(s, 99) is None
        assert (await telegram.select_identity_by_phone(s, PHONE)).account_uid == "a"
        assert (await telegram.select_identity_by_account(s, "a")).telegram_user_id == 1
        await telegram.update_identity_profile(
            s,
            1,
            chat_id=3,
            username=None,
            first_name="Changed",
            last_name="Name",
            language_code="uz",
            now=NOW,
        )
        await telegram.set_identity_phone(s, 1, None, None, NOW)
        await telegram.set_chat_active(s, 1, False, NOW)
    async with sqlite_connector.session() as s:
        rec = await telegram.select_identity_by_telegram_id(s, 1)
        assert (
            rec.chat_id,
            rec.username,
            rec.first_name,
            rec.last_name,
            rec.language_code,
            rec.chat_active,
        ) == (3, None, "Changed", "Name", "uz", False)
        assert rec.phone_e164 is None and rec.phone_verified_at is None
        assert rec.chat_status_changed_at.tzinfo is UTC
        await telegram.set_identity_phone(s, 2, PHONE, NOW, NOW)
        rec = await telegram.select_identity_by_phone(s, PHONE)
        assert rec.account_uid == "b" and rec.phone_verified_at.tzinfo is UTC


async def test_open_challenge_filters_and_selects_newest(sqlite_connector):
    from eventopia.sqls import accounts, otp

    async with sqlite_connector.session() as s:
        await accounts.insert_account(s, "a", NOW)
        for rec in [
            challenge("expired", expires_at=NOW),
            challenge("superseded", superseded_at=NOW),
            challenge("consumed", consumed_at=NOW),
            challenge("old", created_at=NOW - timedelta(seconds=1)),
            challenge("open"),
        ]:
            await otp.insert_challenge(s, rec)
        rec = await otp.select_open_challenge(s, PHONE, NOW)
        assert rec.id == "open" and rec.expires_at.tzinfo is UTC
        assert await otp.increment_attempts(s, "open") == 1
        assert await otp.increment_attempts(s, "open") == 2
        await otp.mark_consumed(s, "open", NOW)
        assert (await otp.select_open_challenge(s, PHONE, NOW)).id == "old"
        await otp.supersede_open_challenges(s, PHONE, NOW)
        assert await otp.select_open_challenge(s, PHONE, NOW) is None


async def test_counts_since_inclusive_and_latest(sqlite_connector):
    from eventopia.sqls import accounts, otp

    since = NOW - timedelta(hours=1)
    async with sqlite_connector.session() as s:
        await accounts.insert_account(s, "a", NOW)
        assert await otp.latest_created_for_phone(s, PHONE) is None
        for i, created in enumerate([since, NOW, NOW, since - timedelta(seconds=1)]):
            await otp.insert_challenge(s, challenge(str(i), created_at=created))
        await otp.insert_challenge(
            s, challenge("other", phone_e164="+998900000002", requester_ip="192.0.2.2")
        )
        assert await otp.count_for_phone_since(s, PHONE, since) == 3
        assert await otp.count_for_ip_since(s, "192.0.2.1", since) == 3
        assert await otp.latest_created_for_phone(s, PHONE) == NOW


async def test_refresh_queries_and_revocations(sqlite_connector):
    from eventopia.sqls import accounts, sessions

    async with sqlite_connector.session() as s:
        for uid in ("a", "b"):
            await accounts.insert_account(s, uid, NOW)
        rec = refresh()
        for item in [rec, refresh("s2"), refresh("s3", "g"), refresh("s4", "h", "b")]:
            await sessions.insert_session(s, item)
        found = await sessions.select_session_by_hash(s, rec.token_hash)
        assert found.id == "s" and found.issued_at.tzinfo is UTC
        assert await sessions.select_session(s, "missing") is None
        assert await sessions.select_session_by_hash(s, token_hex(32)) is None
        await sessions.revoke_session(s, "s", NOW, replaced_by="s2")
        await sessions.revoke_family(s, "f", NOW + timedelta(seconds=1))
        assert (await sessions.select_session(s, "s")).replaced_by == "s2"
        assert (await sessions.select_session(s, "s")).revoked_at == NOW
        assert (await sessions.select_session(s, "s2")).revoked_at is not None
        assert (await sessions.select_session(s, "s3")).revoked_at is None
        await sessions.revoke_all_for_account(s, "a", NOW)
        assert (await sessions.select_session(s, "s3")).revoked_at is not None
        assert (await sessions.select_session(s, "s4")).revoked_at is None


async def test_refresh_hash_unique_and_parameters_hidden(sqlite_connector):
    from eventopia.sqls import accounts, sessions

    rec = refresh()
    async with sqlite_connector.session() as s:
        await accounts.insert_account(s, "a", NOW)
        await sessions.insert_session(s, rec)
    with pytest.raises(IntegrityError) as exc:
        async with sqlite_connector.session() as s:
            await sessions.insert_session(s, replace(rec, id="duplicate"))
    if rec.token_hash in str(exc.value):
        pytest.fail("Database error exposed sensitive parameters")
    if rec.token_hash in repr(rec):
        pytest.fail("Record representation exposed sensitive parameters")


async def test_bot_state_roundtrip_and_upsert(sqlite_connector):
    from eventopia.sqls import bot_state

    async with sqlite_connector.session() as s:
        assert await bot_state.get_value(s, "missing") is None
        await bot_state.set_value(s, "offset", "41")
    async with sqlite_connector.session() as s:
        assert await bot_state.get_value(s, "offset") == "41"
        await bot_state.set_value(s, "offset", "42")
    async with sqlite_connector.session() as s:
        assert await bot_state.get_value(s, "offset") == "42"


async def test_write_reservation_serializes_read_then_write(sqlite_connector):
    from eventopia.sqls import bot_state

    async with sqlite_connector.session() as s:
        await bot_state.set_value(s, "counter", "0")

    async def increment():
        async with sqlite_connector.session(write=True) as s:
            value = int(await bot_state.get_value(s, "counter"))
            await asyncio.sleep(0.01)
            await bot_state.set_value(s, "counter", str(value + 1))

    await asyncio.gather(increment(), increment())
    async with sqlite_connector.session() as s:
        assert await bot_state.get_value(s, "counter") == "2"


async def test_ping_and_closed_connector(sqlite_connector):
    assert await sqlite_connector.ping() is True
    await sqlite_connector.close()
    assert await sqlite_connector.ping() is False


async def test_readiness_reports_sqlite_failure(config, tmp_path, monkeypatch):
    from eventopia.context.neo4j import Neo4jConnector

    async def available(self):
        return True

    monkeypatch.setattr(Neo4jConnector, "ping", available)
    config["sqlite"]["path"] = str(tmp_path / "missing" / "auth.sqlite3")
    container = build_container(config)
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(container)),
            base_url="http://test",
        ) as client:
            response = await client.get("/api/health/ready")
        assert response.status_code == 503
        assert response.json()["data"] == {"neo4j": True, "sqlite": False}
        assert not (tmp_path / "missing").exists()
    finally:
        await container.close()


def test_migration_creates_parent_from_project_config(config, tmp_path, monkeypatch):
    import sqlite3

    import yaml
    from alembic import command
    from alembic.config import Config

    database = tmp_path / "missing" / "auth" / "eventopia.sqlite3"
    config["sqlite"]["path"] = str(database)
    config_path = tmp_path / "config.yaml"
    config_path.write_text(yaml.safe_dump(config))
    monkeypatch.setenv("EVENTOPIA_CONFIG", str(config_path))
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(cfg, "head")
    with sqlite3.connect(database) as db:
        assert db.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "0001_auth_store",
        )
        assert db.execute("SELECT count(*) FROM accounts").fetchone() == (0,)


@pytest.mark.parametrize(
    "url",
    [
        "sqlite:///:memory:",
        "sqlite:///file:named/auth?mode=memory&cache=shared&uri=true",
        "sqlite:///file:named/auth?mode=memory&cache=shared&uri=yes",
    ],
)
def test_migration_preserves_memory_and_uri_paths(tmp_path, monkeypatch, url):
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    monkeypatch.chdir(tmp_path)
    command.upgrade(cfg, "head")
    assert list(tmp_path.iterdir()) == []
