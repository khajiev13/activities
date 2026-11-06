import asyncio
import logging
import re
from datetime import UTC, datetime, timedelta
from itertools import islice
from random import Random
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from neo4j.exceptions import ConstraintError
from sqlalchemy import func, select, update

from eventopia.cyphers import users
from eventopia.exceptions import ForeignContactError, NotFoundError, ValidationError
from eventopia.models.auth import (
    OtpChallengeRecord,
    RefreshSessionRecord,
    SharedContact,
    TelegramUser,
)
from eventopia.services.account import AccountService, username_candidates
from eventopia.sqls import accounts, otp, sessions
from eventopia.sqls.tables import accounts as account_table
from eventopia.sqls.tables import otp_challenges, telegram_identities
from eventopia.wiring import build_container


@pytest.fixture
def account_service(neo4j_connector, sqlite_connector, config):
    return AccountService(neo4j_connector, sqlite_connector, config["auth"])


def tg(id=7, username="Roma_K", first_name="Roma", **kwargs):
    return TelegramUser(id, username, first_name, **kwargs)


def contact(id=7, suffix="67"):
    return SharedContact(id, "+9989012345" + suffix)


def check_phone(actual, expected):
    # Never let assertion rewriting render a phone on a regression.
    if actual != expected:
        pytest.fail("phone mismatch", pytrace=False)


async def count_users(connector):
    async def query(tx):
        result = await tx.run("CYPHER 25 MATCH (u:USER) RETURN count(u) AS total")
        return (await result.single())["total"]

    return await connector.read(query)


async def change_user(connector, uid, clause):
    async def query(tx):
        result = await tx.run("CYPHER 25 MATCH (u:USER {uid:$uid}) " + clause, uid=uid)
        await result.consume()

    await connector.write(query)


async def add_session(sqlite, uid, id):
    now = datetime.now(UTC)
    async with sqlite.session(write=True) as s:
        await sessions.insert_session(
            s,
            RefreshSessionRecord(
                id,
                uid,
                id,
                "hash-" + id,
                now,
                now + timedelta(days=1),
                None,
                None,
                None,
                "127.0.0.1",
            ),
        )


async def test_new_contact_creates_account_identity_and_user(
    account_service, neo4j_connector, sqlite_connector
):
    result = await account_service.register_from_contact(tg(), contact(), 17)
    assert result.is_new and result.username == "roma_k"
    assert UUID(result.uid).version == 4
    check_phone(result.phone_e164, "+998901234567")
    async with sqlite_connector.session() as s:
        account = await accounts.select_account(s, result.uid)
    assert account.status == "active" and account.created_at.tzinfo is not None
    identity = await account_service.get_identity_by_telegram_id(7)
    assert identity.account_uid == result.uid and identity.chat_id == 17
    assert identity.chat_active and identity.phone_verified_at is not None
    profile = await neo4j_connector.read(lambda tx: users.select_user(tx, result.uid))
    assert profile.username == "roma_k" and profile.first_name == "Roma"


@pytest.mark.parametrize("owner", [8, None])
async def test_foreign_contact_rejected_without_writes(
    account_service, sqlite_connector, neo4j_connector, owner
):
    with pytest.raises(ForeignContactError):
        await account_service.register_from_contact(tg(), contact(owner), 7)
    async with sqlite_connector.session() as s:
        assert (
            await s.execute(select(func.count()).select_from(account_table))
        ).scalar() == 0
    assert await count_users(neo4j_connector) == 0


async def test_invalid_phone_does_not_create_identity(account_service):
    with pytest.raises(ValidationError):
        await account_service.register_from_contact(
            tg(), SharedContact(7, "invalid"), 7
        )
    assert await account_service.get_identity_by_telegram_id(7) is None


async def test_sharing_twice_preserves_uid_profile_and_sessions(
    account_service, neo4j_connector, sqlite_connector
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_session(sqlite_connector, a.uid, "same-owner")
    b = await account_service.register_from_contact(
        tg(username="new_handle"), contact(), 8
    )
    assert a.uid == b.uid and not b.is_new and b.username == a.username
    assert await count_users(neo4j_connector) == 1
    async with sqlite_connector.session() as s:
        assert (await sessions.select_session(s, "same-owner")).revoked_at is None
    assert (await account_service.get_identity_by_telegram_id(7)).chat_id == 8


async def test_phone_change_keeps_account(account_service):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    b = await account_service.register_from_contact(tg(), contact(suffix="68"), 7)
    assert b.uid == a.uid and not b.is_new
    assert await account_service.get_active_identity_by_phone("+998901234567") is None
    check_phone(
        (await account_service.get_identity_by_telegram_id(7)).phone_e164,
        "+998901234568",
    )


async def test_takeover_clears_verification_revokes_all_sessions_and_masks_log(
    account_service, sqlite_connector, caplog
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_session(sqlite_connector, a.uid, "one")
    await add_session(sqlite_connector, a.uid, "two")
    with caplog.at_level(logging.WARNING):
        b = await account_service.register_from_contact(tg(9), contact(9), 9)
    assert b.uid != a.uid and b.is_new
    old = await account_service.get_identity_by_telegram_id(7)
    assert old.phone_e164 is None and old.phone_verified_at is None
    assert (
        await account_service.get_active_identity_by_phone("+998901234567")
    ).account_uid == b.uid
    async with sqlite_connector.session() as s:
        for id in ("one", "two"):
            assert (await sessions.select_session(s, id)).revoked_at is not None
    if "+998901234567" in caplog.text or "998901234567" in caplog.text:
        pytest.fail("unmasked phone in logs", pytrace=False)
    assert "+998 90 *** 4567" in caplog.text


async def test_takeover_and_revocation_roll_back_together(
    account_service, sqlite_connector, monkeypatch
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_session(sqlite_connector, a.uid, "rollback")
    original = sessions.revoke_all_for_account

    async def fail_after_revoke(*args):
        await original(*args)
        raise RuntimeError("simulated SQLite failure")

    monkeypatch.setattr(sessions, "revoke_all_for_account", fail_after_revoke)
    with pytest.raises(RuntimeError, match="simulated SQLite failure"):
        await account_service.register_from_contact(tg(9), contact(9), 9)
    assert await account_service.get_identity_by_telegram_id(9) is None
    check_phone(
        (await account_service.get_identity_by_telegram_id(7)).phone_e164,
        "+998901234567",
    )
    async with sqlite_connector.session() as s:
        assert (await sessions.select_session(s, "rollback")).revoked_at is None


async def test_username_falls_back_when_taken(account_service, neo4j_connector):
    await neo4j_connector.write(
        lambda tx: users.merge_user(
            tx, "seed", "roma_k", "Seed", None, datetime.now(UTC).isoformat()
        )
    )
    result = await account_service.register_from_contact(tg(), contact(), 7)
    assert re.fullmatch(r"roma\d{4}", result.username)


@pytest.mark.parametrize("username", [None, "x", "bad-handle", "Ääa", "a" * 33])
def test_username_candidates_reject_invalid_handles_and_bound_slug(username):
    candidates = list(
        islice(username_candidates(username, "A Name!" * 10, Random(4)), 3)
    )
    assert len(set(candidates)) == 3
    assert all(re.fullmatch(r"[a-z0-9_]{1,24}\d{4}", value) for value in candidates)


def test_username_candidates_valid_handle_first_and_empty_slug_fallback():
    assert next(username_candidates("RoMa_K", "Roma", Random(4))) == "roma_k"
    assert re.fullmatch(
        r"[a-z0-9_]+\d{4}", next(username_candidates(None, "🔥", Random(4)))
    )


async def test_ensure_profile_repairs_missing_node_and_preserves_existing_edits(
    account_service, neo4j_connector
):
    result = await account_service.register_from_contact(
        tg(last_name="K"), contact(), 7
    )
    await change_user(
        neo4j_connector,
        result.uid,
        "SET u.first_name='Edited', u.birth_date=date('2000-01-02')",
    )
    profile = await account_service.ensure_profile(result.uid)
    assert profile.first_name == "Edited" and profile.birth_date == "2000-01-02"
    await change_user(neo4j_connector, result.uid, "DETACH DELETE u")
    repaired = await account_service.ensure_profile(result.uid)
    assert repaired.uid == result.uid and repaired.first_name == "Roma"
    assert (
        repaired.last_name == "K"
        and repaired.gender is None
        and repaired.image_url is None
    )


async def test_ensure_profile_unknown_account_is_not_created(
    account_service, neo4j_connector
):
    with pytest.raises(NotFoundError):
        await account_service.ensure_profile("missing")
    assert await count_users(neo4j_connector) == 0


async def test_graph_failure_leaves_committed_identity_and_retry_repairs(
    account_service, neo4j_connector, monkeypatch
):
    original = neo4j_connector.write
    monkeypatch.setattr(
        neo4j_connector, "write", AsyncMock(side_effect=RuntimeError("graph offline"))
    )
    with pytest.raises(RuntimeError, match="graph offline"):
        await account_service.register_from_contact(tg(), contact(), 7)
    identity = await account_service.get_identity_by_telegram_id(7)
    assert identity is not None
    monkeypatch.setattr(neo4j_connector, "write", original)
    result = await account_service.register_from_contact(tg(), contact(), 7)
    assert result.uid == identity.account_uid and not result.is_new
    assert await count_users(neo4j_connector) == 1


async def test_touch_updates_identity_and_reactivates_chat(account_service):
    assert await account_service.touch_identity(tg(), 7) is None
    result = await account_service.register_from_contact(tg(), contact(), 7)
    await account_service.set_chat_active(7, False)
    assert await account_service.get_active_identity_by_phone("+998901234567") is None
    updated = await account_service.touch_identity(
        tg(username="changed", first_name="New", last_name="Name", language_code="uz"),
        19,
    )
    assert (
        updated.account_uid == result.uid
        and updated.chat_active
        and updated.chat_id == 19
    )
    assert (
        updated.username,
        updated.first_name,
        updated.last_name,
        updated.language_code,
    ) == ("changed", "New", "Name", "uz")
    assert (
        await account_service.get_active_identity_by_phone("+998901234567") is not None
    )
    assert (await account_service.ensure_profile(result.uid)).username == "roma_k"


async def test_active_phone_requires_verification(account_service, sqlite_connector):
    await account_service.register_from_contact(tg(), contact(), 7)
    async with sqlite_connector.session(write=True) as s:
        await s.execute(update(telegram_identities).values(phone_verified_at=None))
    assert await account_service.get_active_identity_by_phone("+998901234567") is None
    await account_service.set_chat_active(999, False)


async def test_account_status_cache_expires_after_sixty_seconds(
    account_service, sqlite_connector, monkeypatch
):
    from eventopia.services import account

    clock = [100.0]
    monkeypatch.setattr(account, "monotonic", lambda: clock[0])
    result = await account_service.register_from_contact(tg(), contact(), 7)
    assert await account_service.is_account_active(result.uid)
    async with sqlite_connector.session(write=True) as s:
        await s.execute(
            update(account_table)
            .where(account_table.c.uid == result.uid)
            .values(status="disabled")
        )
    clock[0] = 159.0
    assert await account_service.is_account_active(result.uid)
    clock[0] = 160.0
    assert not await account_service.is_account_active(result.uid)
    assert not await account_service.is_account_active("missing")


async def test_concurrent_same_telegram_registration_creates_one_account(
    account_service, sqlite_connector, neo4j_connector, config
):
    other = AccountService(neo4j_connector, sqlite_connector, config["auth"])
    a, b = await asyncio.gather(
        account_service.register_from_contact(tg(), contact(), 7),
        other.register_from_contact(tg(), contact(), 7),
    )
    assert a.uid == b.uid and sum([a.is_new, b.is_new]) == 1
    assert a.username == b.username and await count_users(neo4j_connector) == 1
    async with sqlite_connector.session() as s:
        assert (
            await s.execute(select(func.count()).select_from(account_table))
        ).scalar() == 1


async def test_concurrent_username_collision_retries_real_unique_constraint(
    account_service, neo4j_connector, monkeypatch
):
    ready = asyncio.Event()
    arrivals = 0
    original = users.username_taken

    async def synchronized_check(tx, username):
        nonlocal arrivals
        result = await original(tx, username)
        if username == "roma_k" and not result:
            arrivals += 1
            if arrivals == 2:
                ready.set()
            await asyncio.wait_for(ready.wait(), 10)
        return result

    monkeypatch.setattr(users, "username_taken", synchronized_check)
    a, b = await asyncio.gather(
        account_service.register_from_contact(tg(), contact(), 7),
        account_service.register_from_contact(tg(9), contact(9, "68"), 9),
    )
    assert a.uid != b.uid and a.username != b.username
    assert "roma_k" in {a.username, b.username}
    assert await count_users(neo4j_connector) == 2


async def test_unrelated_graph_constraint_error_is_not_retried(
    account_service, neo4j_connector, monkeypatch
):
    error = ConstraintError("unrelated constraint")
    monkeypatch.setattr(neo4j_connector, "write", AsyncMock(side_effect=error))
    with pytest.raises(ConstraintError, match="unrelated constraint"):
        await account_service.register_from_contact(tg(), contact(), 7)


def test_sensitive_contact_and_registration_fields_are_not_in_repr():
    from eventopia.models.auth import RegistrationResult

    value = "+998901234567"
    if value in repr(SharedContact(7, value)) or value in repr(
        RegistrationResult("uid", "name", value, True)
    ):
        pytest.fail("sensitive dataclass repr", pytrace=False)


async def test_container_wires_account_service(config):
    container = build_container(config)
    try:
        assert isinstance(container.account_service, AccountService)
    finally:
        await container.close()


async def add_challenge(sqlite, uid, id, shared_contact):
    now = datetime.now(UTC)
    async with sqlite.session(write=True) as s:
        await otp.insert_challenge(
            s,
            OtpChallengeRecord(
                id=id,
                phone_e164=shared_contact.phone_number,
                account_uid=uid,
                code_hash="synthetic-hash-" + id,
                created_at=now,
                expires_at=now + timedelta(minutes=5),
                attempts=0,
                consumed_at=None,
                superseded_at=None,
                requester_ip="127.0.0.1",
                delivered=True,
            ),
        )


async def challenge_state(sqlite, id):
    async with sqlite.session() as s:
        row = (
            await s.execute(
                select(
                    otp_challenges.c.superseded_at, otp_challenges.c.consumed_at
                ).where(otp_challenges.c.id == id)
            )
        ).one()
    return row.superseded_at, row.consumed_at


async def test_otp_transfer_twice_invalidates_each_previous_owner_challenge(
    account_service, sqlite_connector
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_challenge(sqlite_connector, a.uid, "first-owner", contact())
    b = await account_service.register_from_contact(tg(9), contact(9), 9)
    first_superseded, first_consumed = await challenge_state(
        sqlite_connector, "first-owner"
    )
    assert first_superseded is not None and first_consumed is None
    await add_challenge(sqlite_connector, b.uid, "second-owner", contact(9))
    returned = await account_service.register_from_contact(tg(), contact(), 7)
    assert returned.uid == a.uid and not returned.is_new
    second_superseded, second_consumed = await challenge_state(
        sqlite_connector, "second-owner"
    )
    assert second_superseded is not None and second_consumed is None
    async with sqlite_connector.session() as s:
        assert (
            await otp.select_open_challenge(
                s, contact().phone_number, datetime.now(UTC)
            )
            is None
        )
    assert (
        await account_service.get_active_identity_by_phone(contact().phone_number)
    ).account_uid == a.uid


async def test_otp_phone_change_invalidates_old_and_incoming_phone_challenges(
    account_service, sqlite_connector
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    b = await account_service.register_from_contact(tg(9), contact(9, "68"), 9)
    await add_challenge(sqlite_connector, a.uid, "leaving-phone", contact())
    await add_challenge(sqlite_connector, b.uid, "incoming-phone", contact(9, "68"))
    result = await account_service.register_from_contact(tg(), contact(suffix="68"), 7)
    assert result.uid == a.uid and not result.is_new
    for id in ("leaving-phone", "incoming-phone"):
        superseded, consumed = await challenge_state(sqlite_connector, id)
        assert superseded is not None and consumed is None
    async with sqlite_connector.session() as s:
        for shared in (contact(), contact(suffix="68")):
            assert (
                await otp.select_open_challenge(
                    s, shared.phone_number, datetime.now(UTC)
                )
                is None
            )


async def test_otp_identical_sharing_preserves_open_challenge(
    account_service, sqlite_connector
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_challenge(sqlite_connector, a.uid, "unchanged-owner", contact())
    b = await account_service.register_from_contact(tg(), contact(), 7)
    assert b.uid == a.uid and not b.is_new
    superseded, consumed = await challenge_state(sqlite_connector, "unchanged-owner")
    assert superseded is None and consumed is None
    async with sqlite_connector.session() as s:
        challenge = await otp.select_open_challenge(
            s, contact().phone_number, datetime.now(UTC)
        )
    assert challenge.id == "unchanged-owner" and challenge.account_uid == a.uid


async def test_otp_invalidation_rolls_back_with_failed_takeover(
    account_service, sqlite_connector, monkeypatch
):
    a = await account_service.register_from_contact(tg(), contact(), 7)
    await add_session(sqlite_connector, a.uid, "otp-rollback")
    await add_challenge(sqlite_connector, a.uid, "rollback-challenge", contact())
    from eventopia.sqls import telegram

    original = telegram.insert_identity

    async def fail_after_insert(*args):
        await original(*args)
        raise RuntimeError("simulated identity insert failure")

    monkeypatch.setattr(telegram, "insert_identity", fail_after_insert)
    with pytest.raises(RuntimeError, match="simulated identity insert failure"):
        await account_service.register_from_contact(tg(9), contact(9), 9)
    assert await account_service.get_identity_by_telegram_id(9) is None
    assert (
        await account_service.get_active_identity_by_phone(contact().phone_number)
    ).account_uid == a.uid
    async with sqlite_connector.session() as s:
        assert (await sessions.select_session(s, "otp-rollback")).revoked_at is None
        challenge = await otp.select_open_challenge(
            s, contact().phone_number, datetime.now(UTC)
        )
    assert challenge.id == "rollback-challenge" and challenge.account_uid == a.uid
    superseded, consumed = await challenge_state(sqlite_connector, "rollback-challenge")
    assert superseded is None and consumed is None
