import asyncio
import os
import signal

from eventopia.config import load_config
from eventopia.wiring import build_bot_container


async def main() -> None:
    container = build_bot_container(
        load_config(os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml"))
    )
    loop = asyncio.get_running_loop()
    task = asyncio.current_task()
    stopping = False

    def stop() -> None:
        nonlocal stopping
        stopping = True
        task.cancel()

    signals = (signal.SIGTERM, signal.SIGINT)
    try:
        for sig in signals:
            loop.add_signal_handler(sig, stop)
        # deleteWebhook is idempotent and preserves pending updates by default.
        await container.telegram.delete_webhook()
        await container.poller.run_forever()
    except asyncio.CancelledError:
        if not stopping:
            raise
    finally:
        for sig in signals:
            loop.remove_signal_handler(sig)
        await container.close()


if __name__ == "__main__":
    asyncio.run(main())
