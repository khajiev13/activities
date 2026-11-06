import os

from eventopia import create_app
from eventopia.config import load_config
from eventopia.wiring import build_container

app = create_app(
    build_container(
        load_config(os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml"))
    )
)
