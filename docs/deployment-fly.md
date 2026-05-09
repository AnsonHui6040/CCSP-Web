# Deploying CCSP Web to Fly.io

This document describes how to deploy CCSP Web to [Fly.io](https://fly.io) using Docker and a persistent SQLite volume.

---

## Prerequisites

- [flyctl](https://fly.io/docs/getting-started/installing-flyctl/) installed and authenticated (`fly auth login`)
- Docker installed locally (for local build testing)
- A Fly.io account with billing configured

---

## Architecture

| Component | Location in container |
|---|---|
| Next.js web app | `/app/web/` — started via `node server.js` on port 3000 |
| Python importer | `/app/importer/` — called on-demand by the refresh-detail API |
| Python venv | `/app/importer/.venv/` |
| SQLite database | `/app/data/ccsp.sqlite` — on a persistent Fly volume |

The image is built from the `Dockerfile` at the repo root. Data is **not** baked into the image — it lives on a named Fly volume (`ccsp_data`) mounted at `/app/data`.

---

## First-Time Setup

### 1. Create the Fly app

```bash
fly launch --no-deploy
```

Accept the defaults or customise as needed. This creates the `fly.toml` config (already committed to the repo — review before running).

### 2. Create the persistent volume

```bash
fly volumes create ccsp_data --region nrt --size 3
```

- `nrt` = Tokyo region (adjust to your preferred region and update `primary_region` in `fly.toml`)
- `3` = 3 GB (sufficient for SQLite + scraped HTML cache)

**Important:** Only create one volume. Do **not** run multiple machines that share the same SQLite file.

### 3. Set the IMPORTER_PYTHON secret (optional)

`IMPORTER_PYTHON` is already set in `fly.toml [env]`. If you want to override it as a secret instead:

```bash
fly secrets set IMPORTER_PYTHON=/app/importer/.venv/bin/python
```

### 4. Deploy

```bash
fly deploy
```

Fly builds the Docker image and starts the machine. The first deploy will take a few minutes.

---

## Initialise the Database

After the first deploy, the volume is empty. SSH into the machine and run the importer:

```bash
fly ssh console
```

Inside the machine:

```bash
cd /app/importer

# Create the database schema
/app/importer/.venv/bin/python -m ccsp_importer.cli init-db

# Scrape main course list (adjust year/semester as needed)
/app/importer/.venv/bin/python -m ccsp_importer.cli scrape --year 114 --semester 2

# Parse structured notes
/app/importer/.venv/bin/python -m ccsp_importer.cli parse-notes --year 114 --semester 2
```

This takes a few minutes. Once complete, the website will show course data.

---

## Updating Course Data

### Main course data (name, teacher, time, seats, notes)

SSH into the machine and run the update script:

```bash
fly ssh console
cd /app
YEAR=114 SEMESTER=2 bash scripts/update_courses.sh
```

Or run the steps directly:

```bash
/app/importer/.venv/bin/python -m ccsp_importer.cli scrape --year 114 --semester 2
/app/importer/.venv/bin/python -m ccsp_importer.cli parse-notes --year 114 --semester 2
```

### Course detail data (syllabus, grading, office hours)

Detail data is fetched **on demand** when a user clicks "取得詳細資料" on a course detail page. It is **not** scraped in bulk automatically.

To manually fetch a single course detail:

```bash
/app/importer/.venv/bin/python -m ccsp_importer.cli scrape-details \
  --year 114 --semester 2 --course 1249 --force
```

---

## Subsequent Deploys

```bash
fly deploy
```

The volume is preserved across deploys. The database is not affected by deploying a new image.

---

## Environment Variables

| Variable | Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Next.js production mode |
| `DATABASE_PATH` | `/app/data/ccsp.sqlite` | SQLite path for web app |
| `CCSP_DB_PATH` | `/app/data/ccsp.sqlite` | Legacy alias (same as above) |
| `CCSP_DATA_DIR` | `/app/data` | Data directory for importer |
| `IMPORTER_PYTHON` | `/app/importer/.venv/bin/python` | Python interpreter for refresh-detail API |
| `PORT` | `3000` | HTTP port for Next.js |

All are set in `fly.toml [env]`. Do not change `DATABASE_PATH` or `IMPORTER_PYTHON` without also updating the volume mount destination.

---

## Single-Machine Constraint

**Do not scale to more than one machine.**

SQLite does not support concurrent writes from separate processes. The `fly.toml` is configured with:

```toml
min_machines_running = 1
```

and does not include autoscale configuration, keeping exactly one machine active.

If you need horizontal scaling in the future, migrate to a networked database (e.g. Fly Postgres, Turso) first.

---

## Monitoring and Logs

```bash
# Tail logs
fly logs

# Check machine status
fly status

# SSH into machine
fly ssh console
```

---

## Backup the Database

```bash
fly ssh sftp get /app/data/ccsp.sqlite ./ccsp-backup.sqlite
```

Or use `fly volumes`:

```bash
fly volumes list
```

---

## Known Limitations

- Cold-start latency: if `auto_stop_machines = "stop"` and the machine is suspended, the first request after idle will take a few seconds.
- Single region: the machine runs in `nrt` (Tokyo). Change `primary_region` in `fly.toml` and recreate the volume in the new region to move.
- Detail data: course detail pages are fetched on-demand, not pre-populated. Users may see a "not yet fetched" notice on first visit.
