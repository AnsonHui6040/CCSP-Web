import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

// ── Lock file directory ──────────────────────────────────────────────────────
const LOCKS_DIR = path.resolve(process.cwd(), "../data/detail-refresh-locks");
const LOCK_STALE_MS = 60_000; // 60 s

function lockFilePath(year: string, semester: string, courseCode: string): string {
  return path.join(LOCKS_DIR, `${year}-${semester}-${courseCode}.lock`);
}

// ── Input validation ─────────────────────────────────────────────────────────
function isValidYear(v: string): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 100 && n <= 200;
}

function isValidSemester(v: string): boolean {
  return v === "1" || v === "2";
}

// courseCode must be alphanumeric, 1–10 chars
function isValidCourseCode(v: string): boolean {
  return /^[A-Za-z0-9]{1,10}$/.test(v);
}

// ── Same-origin / CSRF check ─────────────────────────────────────────────────
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host") ?? "";

  const hostMatches = (urlStr: string): boolean => {
    try {
      return new URL(urlStr).host === host;
    } catch {
      return false;
    }
  };

  if (origin) return hostMatches(origin);
  if (referer) return hostMatches(referer);
  // If neither header is present, allow only in non-production
  // (e.g. direct curl from the same machine during dev/testing).
  return process.env.NODE_ENV !== "production";
}

// ── IP rate limit ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getClientIp(req: Request): string {
  // Fly.io sets the real client IP in this header
  const flyIp = req.headers.get("fly-client-ip");
  if (flyIp) return flyIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

/** Returns true when the IP has exceeded the per-minute limit. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ── Global concurrency limit ─────────────────────────────────────────────────
let activeRefreshes = 0;
const MAX_CONCURRENT_REFRESHES = 2;

// ── Atomic lock ──────────────────────────────────────────────────────────────
interface LockData {
  createdAt: number;
  pid: number;
  year: string;
  semester: string;
  courseCode: string;
}

/**
 * Attempt to acquire an atomic lock using `openSync("wx")`.
 * If a stale lock (>60 s old) is found, it is removed and one retry is made.
 * Returns true on success, false if already locked by a live process.
 */
function acquireLock(lockPath: string, data: LockData): boolean {
  fs.mkdirSync(LOCKS_DIR, { recursive: true });

  // Attempt 1: atomic exclusive create
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeSync(fd, JSON.stringify(data));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  // Lock file exists — check whether it is stale
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    const existing: LockData = JSON.parse(raw);
    if (Date.now() - existing.createdAt > LOCK_STALE_MS) {
      // Stale — remove and retry once
      fs.unlinkSync(lockPath);
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, JSON.stringify(data));
      fs.closeSync(fd);
      return true;
    }
  } catch {
    // Can't read / parse the lock or re-create it — treat as locked
  }

  return false;
}

function releaseLock(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // already removed or never created — ignore
  }
}

// ── Python interpreter ───────────────────────────────────────────────────────
// Cache result across requests in the same Node process.
let pythonVerified: string | null = null;
let pythonVerifyError: string | null = null;

async function getPythonBin(): Promise<string> {
  if (pythonVerified) return pythonVerified;
  if (pythonVerifyError) throw new Error(pythonVerifyError);

  let python: string;

  if (process.env.NODE_ENV === "production") {
    const envPython = process.env.IMPORTER_PYTHON;
    if (!envPython || !path.isAbsolute(envPython)) {
      pythonVerifyError =
        "IMPORTER_PYTHON must be set to an absolute path in production";
      throw new Error(pythonVerifyError);
    }
    python = envPython;
  } else {
    // Dev: prefer explicit env var, then venv, then system python
    const candidates = [
      process.env.IMPORTER_PYTHON,
      path.resolve(process.cwd(), "../importer/.venv/Scripts/python.exe"),
      path.resolve(process.cwd(), "../importer/.venv/bin/python"),
      "python",
      "python3",
    ].filter(Boolean) as string[];

    let found: string | null = null;
    for (const c of candidates) {
      if (c === "python" || c === "python3") {
        found = c;
        break;
      }
      try {
        fs.accessSync(c, fs.constants.X_OK);
        found = c;
        break;
      } catch {
        // not found — try next
      }
    }
    if (!found) {
      pythonVerifyError = "No Python interpreter found";
      throw new Error(pythonVerifyError);
    }
    python = found;
  }

  // Smoke test: verify ccsp_importer is importable
  try {
    await execFileAsync(python, ["-c", "import ccsp_importer"], {
      cwd: path.resolve(process.cwd(), "../importer"),
      timeout: 10_000,
    });
  } catch {
    pythonVerifyError = `Python interpreter cannot import ccsp_importer`;
    throw new Error(pythonVerifyError);
  }

  pythonVerified = python;
  return python;
}

// ── Route ────────────────────────────────────────────────────────────────────
type Params = Promise<{
  year: string;
  semester: string;
  courseCode: string;
}>;

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { year, semester, courseCode } = await params;

  // ── Same-origin check ──────────────────────────────────────────────────
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { status: "error", code: "FORBIDDEN", message: "禁止存取。" },
      { status: 403 },
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { status: "error", code: "RATE_LIMITED", message: "請求過於頻繁，請稍後再試。" },
      { status: 429 },
    );
  }

  // ── Validate ───────────────────────────────────────────────────────────
  if (
    !isValidYear(year) ||
    !isValidSemester(semester) ||
    !isValidCourseCode(courseCode)
  ) {
    return NextResponse.json(
      { status: "error", code: "INVALID_PARAMS", message: "無效的參數" },
      { status: 400 },
    );
  }

  // ── Concurrency limit ──────────────────────────────────────────────────
  if (activeRefreshes >= MAX_CONCURRENT_REFRESHES) {
    return NextResponse.json(
      {
        status: "error",
        code: "TOO_BUSY",
        message: "目前更新工作已達上限，請稍後再試。",
      },
      { status: 503 },
    );
  }

  // ── Atomic lock ────────────────────────────────────────────────────────
  const lock = lockFilePath(year, semester, courseCode);
  const lockData: LockData = {
    createdAt: Date.now(),
    pid: process.pid,
    year,
    semester,
    courseCode,
  };

  const acquired = acquireLock(lock, lockData);
  if (!acquired) {
    return NextResponse.json(
      { status: "running", message: "此課程詳細資料正在更新中，請稍後再試。" },
      { status: 202 },
    );
  }

  activeRefreshes++;
  try {
    // ── Python ────────────────────────────────────────────────────────
    let python: string;
    try {
      python = await getPythonBin();
    } catch {
      return NextResponse.json(
        {
          status: "error",
          code: "PYTHON_UNAVAILABLE",
          message: "更新服務暫時無法使用。",
        },
        { status: 500 },
      );
    }

    const importerDir = path.resolve(process.cwd(), "../importer");
    await execFileAsync(
      python,
      [
        "-m", "ccsp_importer.cli", "scrape-details",
        "--year", year,
        "--semester", semester,
        "--course", courseCode,
        "--force",
      ],
      { cwd: importerDir, timeout: 30_000 },
    );

    return NextResponse.json({ status: "success", refreshed: true });
  } catch (err) {
    // Log details server-side only — never expose raw error to client
    console.error(
      "[refresh-detail] exec failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { status: "error", code: "EXEC_FAILED", message: "更新失敗，請稍後再試。" },
      { status: 500 },
    );
  } finally {
    activeRefreshes--;
    releaseLock(lock);
  }
}

