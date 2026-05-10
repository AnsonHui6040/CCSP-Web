# ─────────────────────────────────────────────────────────────────────────────
# CCSP Web — Dockerfile
#
# Produces a single image that contains:
#   • Next.js (web/) — served by `next start` on port 3000
#   • Python importer (importer/) — called on-demand by the refresh-detail API
#
# Data (SQLite) lives on a persistent volume mounted at /app/data and is NOT
# baked into this image. Run `init-db` + `scrape` via the platform terminal
# after first deploy.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base

# Install Python 3 and venv tooling (slim image lacks them)
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Stage: install Python importer dependencies into a venv
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS python-deps

COPY importer/requirements.txt importer/requirements.txt

RUN python3 -m venv /app/importer/.venv \
    && /app/importer/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/importer/.venv/bin/pip install --no-cache-dir -r importer/requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Stage: install Node dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS node-deps

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage: build Next.js
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

# Copy web node_modules
COPY --from=node-deps /app/web/node_modules ./web/node_modules
# Copy source
COPY web/ web/
COPY importer/ importer/

# Build-time env: no DB needed during build (all pages are force-dynamic)
ENV NODE_ENV=production

RUN cd web && npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage: production image
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

# Python venv from earlier stage
COPY --from=python-deps /app/importer/.venv /app/importer/.venv

# Importer source (needed at runtime by the venv)
COPY importer/ /app/importer/

# Maintenance scripts (update_courses.sh etc.)
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Next.js standalone output + static assets
COPY --from=builder /app/web/.next/standalone ./web/
COPY --from=builder /app/web/.next/static     ./web/.next/static
COPY --from=builder /app/web/public           ./web/public

# ── Runtime environment ──────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Production DB / importer paths — can be overridden via fly.toml [env]
ENV DATABASE_PATH=/app/data/ccsp.sqlite
ENV CCSP_DB_PATH=/app/data/ccsp.sqlite
ENV CCSP_DATA_DIR=/app/data
ENV IMPORTER_PYTHON=/app/importer/.venv/bin/python

# /app/data is mounted as a persistent volume — the directory must exist
# so the mount point can be created before the volume is attached.
RUN mkdir -p /app/data

WORKDIR /app/web

EXPOSE 3000

# next start (from the standalone output uses server.js)
CMD ["node", "server.js"]
