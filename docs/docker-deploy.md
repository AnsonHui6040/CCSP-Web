# Docker Deployment

CCSP Web can run as one Docker container:

- Next.js standalone server on port `3000`
- Python importer bundled in `/app/importer`
- SQLite database at `/app/data/ccsp.sqlite`

SQLite should be used with one running container instance.

## Quick Start With Compose

From the repo root:

```bash
docker compose up --build -d
```

Open:

```text
http://localhost:3000
```

The Compose file mounts a named volume at `/app/data`. On first start:

1. If the image contains `docker/seed/ccsp.sqlite`, it is copied into the empty volume.
2. Otherwise an empty SQLite schema is created automatically.

## Build And Run Manually

```bash
docker build -t ccsp-web:local .
docker run -d \
  --name ccsp-web \
  -p 3000:3000 \
  -v ccsp-data:/app/data \
  ccsp-web:local
```

## Updating Course Data

Run inside the container:

```bash
docker exec -it ccsp-web bash -lc 'YEAR=114 SEMESTER=2 bash /app/scripts/update_courses.sh'
```

To initialise only the schema:

```bash
docker exec -it ccsp-web bash -lc '/app/importer/.venv/bin/python -m ccsp_importer.cli init-db'
```

## Portable Deploy Pack

Create a tarball that includes the Docker files and a snapshot of the local SQLite database:

```bash
bash scripts/make_docker_pack.sh
```

Output:

```text
dist/ccsp-web-docker-pack.tar.gz
```

On the target machine:

```bash
tar -xzf ccsp-web-docker-pack.tar.gz
cd ccsp-web-docker-pack
docker compose up --build -d
```

If the pack includes `docker/seed/ccsp.sqlite`, the first container start will seed the persistent volume automatically.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `HOSTNAME` | `0.0.0.0` | Container bind address |
| `DATABASE_PATH` | `/app/data/ccsp.sqlite` | SQLite path used by web and importer |
| `CCSP_DB_PATH` | `/app/data/ccsp.sqlite` | Legacy SQLite alias |
| `CCSP_DATA_DIR` | `/app/data` | Importer data directory |
| `IMPORTER_PYTHON` | `/app/importer/.venv/bin/python` | Python interpreter for detail refresh |

## Notes

- Keep replicas at `1`; SQLite is not suitable for multiple writer containers.
- Rebuilding the image does not overwrite an existing Docker volume. To reseed from a new pack, remove the old volume first:

```bash
docker compose down -v
docker compose up --build -d
```
