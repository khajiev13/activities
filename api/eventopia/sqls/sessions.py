from dataclasses import asdict
from datetime import datetime

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from eventopia.models.auth import RefreshSessionRecord
from eventopia.sqls.tables import refresh_sessions as sessions


async def insert_session(s: AsyncSession, rec: RefreshSessionRecord) -> None:
    await s.execute(insert(sessions).values(**asdict(rec)))


async def select_session_by_hash(
    s: AsyncSession,
    token_hash: str,
) -> RefreshSessionRecord | None:
    row = (
        (await s.execute(select(sessions).where(sessions.c.token_hash == token_hash)))
        .mappings()
        .one_or_none()
    )
    return RefreshSessionRecord(**row) if row is not None else None


async def select_session(s: AsyncSession, id: str) -> RefreshSessionRecord | None:
    row = (
        (await s.execute(select(sessions).where(sessions.c.id == id)))
        .mappings()
        .one_or_none()
    )
    return RefreshSessionRecord(**row) if row is not None else None


async def revoke_session(
    s: AsyncSession,
    id: str,
    now: datetime,
    replaced_by: str | None = None,
) -> None:
    await s.execute(
        update(sessions)
        .where(
            sessions.c.id == id,
            sessions.c.revoked_at.is_(None),
        )
        .values(revoked_at=now, replaced_by=replaced_by)
    )


async def revoke_family(s: AsyncSession, family_id: str, now: datetime) -> None:
    await s.execute(
        update(sessions)
        .where(
            sessions.c.family_id == family_id,
            sessions.c.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


async def revoke_all_for_account(s: AsyncSession, uid: str, now: datetime) -> None:
    await s.execute(
        update(sessions)
        .where(
            sessions.c.account_uid == uid,
            sessions.c.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
