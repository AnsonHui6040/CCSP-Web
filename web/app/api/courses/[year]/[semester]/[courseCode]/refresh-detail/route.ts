import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

// ── Lock file directory ──────────────────────────────────────────────────────
// Stored in <repo-root>/data/detail-refresh-locks/
const LOCKS_DIR = path.resolve(process.cwd(), "../data/detail-refresh-locks");

function lockPath(year: string, semester: string, courseCode: string): string {
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

// ── Python interpreter path ──────────────────────────────────────────────────
// Prefer the venv python if it exists; fall back to system python.
function pythonBin(): string {
  const candidates = [
    path.resolve(process.cwd(), "../importer/.venv/Scripts/python.exe"),
    path.resolve(process.cwd(), "../importer/.venv/bin/python"),
    "python",
  ];
  for (const c of candidates) {
    if (c === "python") return c;
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      // not found / not executable — try next
    }
  }
  return "python";
}

type Params = Promise<{
  year: string;
  semester: string;
  courseCode: string;
}>;

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { year, semester, courseCode } = await params;

  // ── Validate ─────────────────────────────────────────────────────────────
  if (!isValidYear(year) || !isValidSemester(semester) || !isValidCourseCode(courseCode)) {
    return NextResponse.json(
      { status: "error", message: "無效的參數" },
      { status: 400 },
    );
  }

  // ── Lock ─────────────────────────────────────────────────────────────────
  fs.mkdirSync(LOCKS_DIR, { recursive: true });
  const lock = lockPath(year, semester, courseCode);

  if (fs.existsSync(lock)) {
    return NextResponse.json(
      { status: "running", message: "此課程詳細資料正在更新中，請稍後再試。" },
      { status: 202 },
    );
  }

  // Create lock
  fs.writeFileSync(lock, String(Date.now()));

  try {
    const python = pythonBin();
    const importerDir = path.resolve(process.cwd(), "../importer");

    await execFileAsync(
      python,
      [
        "-m",
        "ccsp_importer.cli",
        "scrape-details",
        "--year",
        year,
        "--semester",
        semester,
        "--course",
        courseCode,
        "--force",
      ],
      {
        cwd: importerDir,
        timeout: 30_000, // 30 s hard cap
      },
    );

    return NextResponse.json({ status: "success", refreshed: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "更新失敗，請稍後再試。";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  } finally {
    // Always remove lock even on failure
    try {
      fs.unlinkSync(lock);
    } catch {
      // already removed or never created — ignore
    }
  }
}
