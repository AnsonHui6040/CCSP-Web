import "server-only";
import type { SQLInputValue } from "node:sqlite";
import { getDb } from "./db";
import type { TagKey, TagLevel } from "./tags";
import type {
  Course,
  CourseSearchParams,
  Rule,
  Teacher,
  Term,
  TimeSlot,
  Warning,
} from "./types";

/** Map a SQLite row to a typed Course. */
function rowToCourse(row: Record<string, unknown>): Course {
  const teachers = safeParseArray<Teacher>(row.teachers_json);
  const timeSlots = safeParseArray<TimeSlot>(row.time_slots_json);
  const tags = safeParseArray<string>(row.tags_json) as TagKey[];
  const warnings = safeParseArray<Warning>(row.warnings_json);
  const rules = safeParseArray<Rule>(row.rules_json);
  const riskRaw = (row.risk_level as string | null) ?? "low";
  const riskLevel: TagLevel =
    riskRaw === "high" || riskRaw === "medium" ? riskRaw : "low";
  return {
    id: row.id as number,
    year: row.year as number,
    semester: row.semester as number,
    courseCode: row.course_code as string,
    courseName: row.course_name as string,
    courseNameEn: (row.course_name_en as string | null) ?? null,
    requiredOrElective: (row.required_or_elective as string | null) ?? null,
    creditsRaw: (row.credits_raw as string | null) ?? null,
    creditsLecture: (row.credits_lecture as number | null) ?? null,
    creditsLab: (row.credits_lab as number | null) ?? null,
    creditsTotal: (row.credits_total as number | null) ?? null,
    deptCode: (row.dept_code as string | null) ?? null,
    deptName: (row.dept_name as string | null) ?? null,
    teachers,
    timeRaw: (row.time_raw as string | null) ?? null,
    timeSlots,
    capacity: (row.capacity as number | null) ?? null,
    enrolled: (row.enrolled as number | null) ?? null,
    remaining: (row.remaining as number | null) ?? null,
    rawNote: (row.raw_note as string | null) ?? null,
    courseProfileId: (row.course_profile_id as string | null) ?? null,
    scrapedAt: row.scraped_at as string,
    tags,
    warnings,
    rules,
    riskLevel,
  };
}

function safeParseArray<T>(json: unknown): T[] {
  if (typeof json !== "string" || !json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// queries

export type CourseListResult = {
  rows: Course[];
  total: number;
};

const COLUMNS = [
  "id",
  "year",
  "semester",
  "course_code",
  "course_name",
  "course_name_en",
  "required_or_elective",
  "credits_raw",
  "credits_lecture",
  "credits_lab",
  "credits_total",
  "dept_code",
  "dept_name",
  "teachers_json",
  "time_raw",
  "time_slots_json",
  "capacity",
  "enrolled",
  "remaining",
  "raw_note",
  "course_profile_id",
  "scraped_at",
  "tags_json",
  "warnings_json",
  "rules_json",
  "risk_level",
].join(", ");

/** Search courses with filters. SQLite LIKE is good enough for V1. */
export function searchCourses(params: CourseSearchParams): CourseListResult {
  const db = getDb();
  const where: string[] = [];
  const args: SQLInputValue[] = [];

  if (params.year !== undefined) {
    where.push("year = ?");
    args.push(params.year);
  }
  if (params.semester !== undefined) {
    where.push("semester = ?");
    args.push(params.semester);
  }
  if (params.deptCode) {
    where.push("dept_code = ?");
    args.push(params.deptCode);
  }
  if (params.requiredOnly) {
    where.push("required_or_elective LIKE '%必%'");
  }
  if (params.hasOpening) {
    // Treat NULL as "unknown / probably full" — the THU page hides 餘額
    // when enrolled > capacity, which is exactly the case users do *not*
    // want surfaced under 尚有名額.
    where.push("remaining > 0");
  }
  if (params.weekday !== undefined) {
    // Match any time slot with this weekday. JSON stored as text — use LIKE.
    where.push("time_slots_json LIKE ?");
    args.push(`%"weekday": ${params.weekday}%`);
  }
  if (params.q) {
    const q = `%${params.q}%`;
    where.push(
      "(course_name LIKE ? OR course_name_en LIKE ? OR course_code LIKE ? OR teachers_json LIKE ?)",
    );
    args.push(q, q, q, q);
  }

  // Tag-based filters. The tag list is short and tags are stored as a JSON
  // array in tags_json, so substring LIKE on the JSON is fine for V1
  // (no FTS, no JSON1 tax).
  function tagPresent(key: string) {
    return `tags_json LIKE '%"${key}"%'`;
  }
  if (params.englishTaught) where.push(tagPresent("english_taught"));
  if (params.remote) where.push(tagPresent("remote"));
  if (params.restrictedOnly) where.push(tagPresent("restricted"));
  if (params.hideNoOnline) where.push(`NOT (${tagPresent("online_selection_unavailable")})`);
  if (params.hideManual) where.push(`NOT (${tagPresent("manual_selection_required")})`);
  if (params.hideNotCountGraduation)
    where.push(`NOT (${tagPresent("not_count_graduation")})`);
  if (params.riskLevel) {
    where.push("risk_level = ?");
    args.push(params.riskLevel);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(params.limit ?? 100, 500);
  const offset = params.offset ?? 0;

  const rowsStmt = db.prepare(
    `SELECT ${COLUMNS} FROM courses ${whereSql}
     ORDER BY year DESC, semester DESC, course_code ASC
     LIMIT ? OFFSET ?`,
  );
  const rows = (rowsStmt.all(...args, limit, offset) as Record<string, unknown>[]).map(
    rowToCourse,
  );

  const totalStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM courses ${whereSql}`,
  );
  const total = (totalStmt.get(...args) as { n: number }).n;

  return { rows, total };
}

/** Used by the term switcher and dept dropdown. */
export function listTerms(): Term[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT year, semester FROM courses ORDER BY year DESC, semester DESC`,
    )
    .all() as Array<{ year: number; semester: 1 | 2 }>;
  // Plain-object copy so React can serialize when this is passed to a
  // client component (TermSwitcher).
  return rows.map((r) => ({ year: r.year, semester: r.semester }));
}

export function listDepartments(term: Term): Array<{
  code: string;
  name: string;
  count: number;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT dept_code AS code, dept_name AS name, COUNT(*) AS count
         FROM courses
        WHERE year = ? AND semester = ? AND dept_code IS NOT NULL
        GROUP BY dept_code, dept_name
        ORDER BY dept_code`,
    )
    .all(term.year, term.semester) as Array<{
    code: string;
    name: string;
    count: number;
  }>;
  // node:sqlite rows have a non-plain prototype, which React 19 refuses to
  // serialize across the server→client boundary. Spread to plain objects.
  return rows.map((r) => ({ code: r.code, name: r.name, count: r.count }));
}

export function getCourseByCode(
  term: Term,
  courseCode: string,
): Course | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ${COLUMNS} FROM courses WHERE year = ? AND semester = ? AND course_code = ?`,
    )
    .get(term.year, term.semester, courseCode) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCourse(row) : null;
}
