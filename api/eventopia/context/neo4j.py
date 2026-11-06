import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from neo4j import READ_ACCESS, AsyncGraphDatabase, AsyncManagedTransaction
from neo4j.exceptions import DriverError, Neo4jError

from eventopia.config import Neo4jSection

T = TypeVar("T")


class Neo4jConnector:
    def __init__(self, config: Neo4jSection) -> None:
        self._driver = AsyncGraphDatabase.driver(
            config["uri"], auth=(config["user"], config["password"])
        )
        self._database = config["database"]

    async def read(self, work: Callable[[AsyncManagedTransaction], Awaitable[T]]) -> T:
        async with self._driver.session(database=self._database) as session:
            return await session.execute_read(work)

    async def write(self, work: Callable[[AsyncManagedTransaction], Awaitable[T]]) -> T:
        async with self._driver.session(database=self._database) as session:
            return await session.execute_write(work)

    async def ping(self) -> bool:
        try:
            # An auto-commit read avoids managed retry delays for health checks.
            async with asyncio.timeout(5):
                async with self._driver.session(
                    database=self._database, default_access_mode=READ_ACCESS
                ) as session:
                    result = await session.run("CYPHER 25 RETURN 1 AS ready")
                    record = await result.single()
                    return record is not None and record["ready"] == 1
        except (DriverError, Neo4jError, OSError, TimeoutError):
            return False

    async def close(self) -> None:
        await self._driver.close()
