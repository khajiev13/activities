import os
from pathlib import Path

from alembic import context
from sqlalchemy import URL, create_engine, event, pool
from sqlalchemy.engine import make_url
from sqlalchemy.util import asbool

from eventopia.config import load_config
from eventopia.sqls.tables import metadata

config = context.config
url = config.get_main_option("sqlalchemy.url")
if not url:
    app_config = load_config(
        os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml")
    )
    url = URL.create("sqlite", database=app_config["sqlite"]["path"])

if context.is_offline_mode():
    context.configure(url=url, target_metadata=metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    url = make_url(url)
    # sqlite3 creates the file but cannot create its parent directories.
    # URI paths and in-memory databases are interpreted by SQLite itself.
    if (
        url.get_backend_name() == "sqlite"
        and url.database not in (None, "", ":memory:")
        and not asbool(url.query.get("uri", False))
    ):
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, poolclass=pool.NullPool, hide_parameters=True)

    @event.listens_for(engine, "connect")
    def configure_connection(connection, record):
        connection.isolation_level = None
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    @event.listens_for(engine, "begin")
    def begin_transaction(connection):
        connection.exec_driver_sql("BEGIN")

    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()
