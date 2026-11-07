import asyncio
import logging
import os
from pathlib import Path
from random import Random

from eventopia.config import load_config
from eventopia.seed.loader import seed_all

_logger = logging.getLogger(__name__)


async def _main() -> None:
    from eventopia.wiring import build_container

    container = build_container(
        load_config(os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml"))
    )
    try:
        summary = await seed_all(
            container.neo4j, Path(__file__).with_name("data"), Random()
        )
        _logger.info(
            "Seeded teams=%d players=%d memberships=%d leagues=%d pitches=%d",
            summary.teams,
            summary.players,
            summary.memberships,
            summary.leagues,
            summary.pitches,
        )
    finally:
        await container.close()


if __name__ == "__main__":
    asyncio.run(_main())
