#!/bin/sh
set -eu
alembic upgrade head
python -m eventopia.schema.apply
exec "$@"
