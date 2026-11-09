from datetime import datetime

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from eventopia.models.auth import AccountRecord
from eventopia.sqls.tables import accounts


async def insert_account(s: AsyncSession, uid: str, now: datetime) -> None:
    await s.execute(insert(accounts).values(uid=uid, status="active", created_at=now))


async def select_account(s: AsyncSession, uid: str) -> AccountRecord | None:
    row = (
        (await s.execute(select(accounts).where(accounts.c.uid == uid)))
        .mappings()
        .one_or_none()
    )
    return AccountRecord(**row) if row is not None else None
