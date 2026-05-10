#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$REPO_ROOT/dist"
PACK_NAME="${PACK_NAME:-ccsp-web-docker-pack}"
PACK_DIR="$DIST_DIR/$PACK_NAME"
ARCHIVE="$DIST_DIR/$PACK_NAME.tar.gz"
SEED_DB="$PACK_DIR/docker/seed/ccsp.sqlite"

rm -rf "$PACK_DIR" "$ARCHIVE"
mkdir -p "$DIST_DIR"

rsync -a \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude 'dist/' \
  --exclude 'data/' \
  --exclude 'node_modules/' \
  --exclude 'web/node_modules/' \
  --exclude 'web/.next/' \
  --exclude 'web/*.tsbuildinfo' \
  --exclude 'importer/.venv/' \
  --exclude 'importer/.pytest_cache/' \
  --exclude '.venv/' \
  "$REPO_ROOT/" "$PACK_DIR/"

if [ -f "$REPO_ROOT/data/ccsp.sqlite" ]; then
  mkdir -p "$(dirname "$SEED_DB")"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$REPO_ROOT/data/ccsp.sqlite" ".backup '$SEED_DB'"
  else
    cp "$REPO_ROOT/data/ccsp.sqlite" "$SEED_DB"
  fi
  echo "Seed database added: docker/seed/ccsp.sqlite"
else
  echo "No local data/ccsp.sqlite found; pack will initialise an empty DB on first start."
fi

tar -C "$DIST_DIR" -czf "$ARCHIVE" "$PACK_NAME"

echo "Docker deploy pack written to: $ARCHIVE"
