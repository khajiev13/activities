from dataclasses import asdict
from datetime import datetime

from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from eventopia.models.auth import OtpChallengeRecord
from eventopia.sqls.tables import otp_challenges as challenges


async def insert_challenge(s: AsyncSession, rec: OtpChallengeRecord) -> None:
    await s.execute(insert(challenges).values(**asdict(rec)))


async def select_open_challenge(
    s: AsyncSession,
    phone: str,
    now: datetime,
) -> OtpChallengeRecord | None:
    row = (
        (
            await s.execute(
                select(challenges)
                .where(
                    challenges.c.phone_e164 == phone,
                    challenges.c.consumed_at.is_(None),
                    challenges.c.superseded_at.is_(None),
                    challenges.c.expires_at > now,
                )
                .order_by(challenges.c.created_at.desc(), challenges.c.id.desc())
                .limit(1)
            )
        )
        .mappings()
        .one_or_none()
    )
    return OtpChallengeRecord(**row) if row is not None else None


async def supersede_open_challenges(s: AsyncSession, phone: str, now: datetime) -> None:
    await s.execute(
        update(challenges)
        .where(
            challenges.c.phone_e164 == phone,
            challenges.c.consumed_at.is_(None),
            challenges.c.superseded_at.is_(None),
            challenges.c.expires_at > now,
        )
        .values(superseded_at=now)
    )


async def increment_attempts(s: AsyncSession, id: str) -> int:
    return (
        await s.execute(
            update(challenges)
            .where(challenges.c.id == id)
            .values(attempts=challenges.c.attempts + 1)
            .returning(challenges.c.attempts)
        )
    ).scalar_one()


async def mark_consumed(s: AsyncSession, id: str, now: datetime) -> None:
    await s.execute(
        update(challenges).where(challenges.c.id == id).values(consumed_at=now)
    )


async def count_for_phone_since(s: AsyncSession, phone: str, since: datetime) -> int:
    return (
        await s.execute(
            select(func.count())
            .select_from(challenges)
            .where(
                challenges.c.phone_e164 == phone,
                challenges.c.created_at >= since,
            )
        )
    ).scalar_one()


async def count_for_ip_since(s: AsyncSession, ip: str, since: datetime) -> int:
    return (
        await s.execute(
            select(func.count())
            .select_from(challenges)
            .where(
                challenges.c.requester_ip == ip,
                challenges.c.created_at >= since,
            )
        )
    ).scalar_one()


async def latest_created_for_phone(s: AsyncSession, phone: str) -> datetime | None:
    return (
        await s.execute(
            select(func.max(challenges.c.created_at)).where(
                challenges.c.phone_e164 == phone,
            )
        )
    ).scalar_one()


async def nth_latest_created_for_phone(
    s: AsyncSession, phone: str, n: int
) -> datetime | None:
    return (
        await s.execute(
            select(challenges.c.created_at)
            .where(challenges.c.phone_e164 == phone)
            .order_by(challenges.c.created_at.desc(), challenges.c.id.desc())
            .offset(n - 1)
            .limit(1)
        )
    ).scalar_one_or_none()


async def nth_latest_created_for_ip(
    s: AsyncSession, ip: str, n: int
) -> datetime | None:
    return (
        await s.execute(
            select(challenges.c.created_at)
            .where(challenges.c.requester_ip == ip)
            .order_by(challenges.c.created_at.desc(), challenges.c.id.desc())
            .offset(n - 1)
            .limit(1)
        )
    ).scalar_one_or_none()


async def mark_delivered(s: AsyncSession, id: str, now: datetime) -> None:
    await s.execute(
        update(challenges)
        .where(
            challenges.c.id == id,
            challenges.c.consumed_at.is_(None),
            challenges.c.superseded_at.is_(None),
            challenges.c.expires_at > now,
        )
        .values(delivered=True)
    )
