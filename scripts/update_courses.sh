#!/usr/bin/env bash
# update_courses.sh
#
# Daily maintenance script — runs at 04:00 by cron / task scheduler.
#
# What this does:
#   1. Scrape the latest main course data (name, teachers, time, classroom,
#      capacity, raw notes).
#   2. Re-parse all notes to refresh tags / warnings / rules / risk_level.
#
# What this does NOT do:
#   - Fetch course detail pages (scrape-details).
#     Detail pages are fetched on-demand when the user presses
#     "取得詳細資料" / "更新詳細資料" on the course detail page.
#   - Run scrape-details --force across all courses.
#   - Run textbook extraction.
#
# Usage:
#   YEAR=114 SEMESTER=2 bash scripts/update_courses.sh
#
# Crontab example (daily at 04:00):
#   0 4 * * * cd /path/to/CCSP-Web && YEAR=114 SEMESTER=2 bash scripts/update_courses.sh >> /var/log/ccsp-update.log 2>&1

set -euo pipefail

YEAR=${YEAR:-114}
SEMESTER=${SEMESTER:-2}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMPORTER_DIR="$REPO_ROOT/importer"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting daily course update (year=$YEAR semester=$SEMESTER)"

cd "$IMPORTER_DIR"

# ── Step 1: Scrape main course data ─────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Step 1: scrape main course data"
python -m ccsp_importer.cli scrape --year "$YEAR" --semester "$SEMESTER"

# ── Step 2: Re-parse notes (tags / warnings / rules / risk_level) ────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Step 2: parse-notes"
python -m ccsp_importer.cli parse-notes --year "$YEAR" --semester "$SEMESTER"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done."
