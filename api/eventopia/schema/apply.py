import asyncio
import os
from pathlib import Path

from neo4j import AsyncManagedTransaction

from eventopia.config import load_config
from eventopia.context.neo4j import Neo4jConnector


async def apply_constraints(connector: Neo4jConnector) -> None:
    statements = (
        Path(__file__).with_name("constraints.cypher").read_text(encoding="utf-8")
    )

    async def apply(tx: AsyncManagedTransaction) -> None:
        for statement in statements.split(";"):
            if statement.strip():
                result = await tx.run(statement)
                await result.consume()

    await connector.write(apply)


async def _main() -> None:
    from eventopia.wiring import build_container

    container = build_container(
        load_config(os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml"))
    )
    try:
        await apply_constraints(container.neo4j)
    finally:
        await container.close()


if __name__ == "__main__":
    asyncio.run(_main())
