from dataclasses import asdict
from datetime import datetime

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from eventopia.models.auth import TelegramIdentityRecord
from eventopia.sqls.tables import telegram_identities as identities


async def select_identity_by_telegram_id(
    s: AsyncSession,
    tg_id: int,
) -> TelegramIdentityRecord | None:
    row = (
        (
            await s.execute(
                select(identities).where(identities.c.telegram_user_id == tg_id)
            )
        )
        .mappings()
        .one_or_none()
    )
    return TelegramIdentityRecord(**row) if row is not None else None


async def select_identity_by_phone(
    s: AsyncSession,
    phone: str,
) -> TelegramIdentityRecord | None:
    row = (
        (await s.execute(select(identities).where(identities.c.phone_e164 == phone)))
        .mappings()
        .one_or_none()
    )
    return TelegramIdentityRecord(**row) if row is not None else None


async def select_identity_by_account(
    s: AsyncSession,
    uid: str,
) -> TelegramIdentityRecord | None:
    row = (
        (await s.execute(select(identities).where(identities.c.account_uid == uid)))
        .mappings()
        .one_or_none()
    )
    return TelegramIdentityRecord(**row) if row is not None else None


async def insert_identity(s: AsyncSession, rec: TelegramIdentityRecord) -> None:
    await s.execute(insert(identities).values(**asdict(rec)))


async def update_identity_profile(
    s: AsyncSession,
    tg_id: int,
    *,
    chat_id: int,
    username: str | None,
    first_name: str | None,
    last_name: str | None,
    language_code: str | None,
    now: datetime,
) -> None:
    await s.execute(
        update(identities)
        .where(identities.c.telegram_user_id == tg_id)
        .values(
            chat_id=chat_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            language_code=language_code,
            updated_at=now,
        )
    )


async def set_identity_phone(
    s: AsyncSession,
    tg_id: int,
    phone_e164: str | None,
    verified_at: datetime | None,
    now: datetime,
) -> None:
    await s.execute(
        update(identities)
        .where(identities.c.telegram_user_id == tg_id)
        .values(phone_e164=phone_e164, phone_verified_at=verified_at, updated_at=now)
    )


async def set_chat_active(
    s: AsyncSession,
    tg_id: int,
    active: bool,
    now: datetime,
) -> None:
    await s.execute(
        update(identities)
        .where(identities.c.telegram_user_id == tg_id)
        .values(chat_active=active, chat_status_changed_at=now, updated_at=now)
    )
