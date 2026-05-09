import "server-only";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Singleton read-only connection to data/ccsp.sqlite.
 *
 * `node:sqlite` (stable on Node 22.5+, shipped with Node 24) gives us a
 * synchronous SQLite handle without a native build step. We open it once
 * per process and reuse via a global cache.
 */

declare global {
  // eslint-disable-next-line no-var
  var __ccspDb: DatabaseSync | undefined;
}

// DATABASE_PATH (Fly.io / production) takes priority, then CCSP_DB_PATH
// (legacy alias), then the repo-relative default for local dev.
const DB_RELATIVE =
  process.env.DATABASE_PATH ??
  process.env.CCSP_DB_PATH ??
  "../data/ccsp.sqlite";

function open(): DatabaseSync {
  const abs = path.resolve(process.cwd(), DB_RELATIVE);
  // readOnly + open prevents the WAL companion files from being created
  // by the web process; the importer is the sole writer.
  return new DatabaseSync(abs, { readOnly: true, open: true });
}

export function getDb(): DatabaseSync {
  if (!globalThis.__ccspDb) {
    globalThis.__ccspDb = open();
  }
  return globalThis.__ccspDb;
}

export type DbHandle = DatabaseSync;
