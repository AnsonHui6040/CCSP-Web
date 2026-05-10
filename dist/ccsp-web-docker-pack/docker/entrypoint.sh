#!/bin/sh
set -eu

DATABASE_PATH="${DATABASE_PATH:-/app/data/ccsp.sqlite}"
CCSP_DATA_DIR="${CCSP_DATA_DIR:-/app/data}"
IMPORTER_PYTHON="${IMPORTER_PYTHON:-/app/importer/.venv/bin/python}"
SEED_DB="${SEED_DB:-/app/seed/ccsp.sqlite}"

mkdir -p "$(dirname "$DATABASE_PATH")" "$CCSP_DATA_DIR"

if [ ! -f "$DATABASE_PATH" ]; then
  if [ -f "$SEED_DB" ]; then
    echo "[entrypoint] Seeding SQLite database from $SEED_DB"
    cp "$SEED_DB" "$DATABASE_PATH"
  else
    echo "[entrypoint] No SQLite database found; initialising empty schema"
    (cd /app/importer && "$IMPORTER_PYTHON" -m ccsp_importer.cli init-db)
  fi
fi

exec "$@"
