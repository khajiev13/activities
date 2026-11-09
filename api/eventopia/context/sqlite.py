import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import URL, event, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from eventopia.config import SqliteSection


class SqliteConnector:
    def __init__(self, config: SqliteSection) -> None:
        self._engine = create_async_engine(
            URL.create("sqlite+aiosqlite", database=config["path"]),
            hide_parameters=True,
        )
        event.listen(self._engine.sync_engine, "connect", self._configure_connection)
        self._sessions = async_sessionmaker(self._engine, expire_on_commit=False)
        self._closed = False

    @staticmethod
    def _configure_connection(connection, record) -> None:
        # Disable sqlite3's implicit transaction handling: every session below
        # explicitly begins, so reads and writes share a real transaction.
        connection.isolation_level = None
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    @asynccontextmanager
    async def session(self, *, write: bool = False) -> AsyncIterator[AsyncSession]:
        """Commit on success, rollback on error.

        Use write=True for read-modify-write operations: BEGIN IMMEDIATE takes
        the shared file's write reservation before reads, across API/bot processes.
        """
        if self._closed:
            raise RuntimeError("SQLite connector is closed")
        async with self._sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE" if write else "BEGIN"))
            yield session

    async def ping(self) -> bool:
        if self._closed:
            return False
        try:
            async with asyncio.timeout(5):
                async with self.session() as session:
                    return (await session.execute(text("SELECT 1"))).scalar() == 1
        except (SQLAlchemyError, OSError, TimeoutError):
            return False

    async def close(self) -> None:
        self._closed = True
        await self._engine.dispose()
