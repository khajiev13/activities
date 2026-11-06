from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from eventopia.sqls.tables import bot_state


async def get_value(s: AsyncSession, key: str) -> str | None:
    return (
        await s.execute(select(bot_state.c.value).where(bot_state.c.key == key))
    ).scalar_one_or_none()


async def set_value(s: AsyncSession, key: str, value: str) -> None:
    await s.execute(
        insert(bot_state)
        .values(key=key, value=value)
        .on_conflict_do_update(index_elements=[bot_state.c.key], set_={"value": value})
    )
