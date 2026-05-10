/**
 * Domain types shared across server and client code.
 *
 * The DB stores `teachers_json` and `time_slots_json` as raw strings;
 * `Course` is the parsed view that the rest of the app consumes.
 */

import type { TagKey, TagLevel } from "./tags";

export type Teacher = {
  name: string;
  slug: string | null;
};

export type TimeSlot = {
  weekday: number; // 1..7 (Mon..Sun)
  periods: string[]; // e.g. ["7","8","9"] or ["A","B"]
  classroom: string | null;
};

export type Warning = {
  type: TagKey;
  level: TagLevel;
  message: string;
};

export type Rule = {
  type: "restriction";
  value: string;
  source: "raw_note";
};

export type Course = {
  id: number;
  year: number;
  semester: number;
  courseCode: string;
  courseName: string;
  courseNameEn: string | null;
  requiredOrElective: string | null;
  creditsRaw: string | null;
  creditsLecture: number | null;
  creditsLab: number | null;
  creditsTotal: number | null;
  deptCode: string | null;
  deptName: string | null;
  teachers: Teacher[];
  timeRaw: string | null;
  timeSlots: TimeSlot[];
  capacity: number | null;
  enrolled: number | null;
  remaining: number | null;
  rawNote: string | null;
  courseProfileId: string | null;
  scrapedAt: string;
  // Phase-2 derivations from raw_note
  tags: TagKey[];
  warnings: Warning[];
  rules: Rule[];
  riskLevel: TagLevel;
};

/** Minimal "term" identifier the UI passes around. */
export type Term = {
  year: number;
  semester: 1 | 2;
};

/** One row in the 評分方式 table. */
export type GradingPolicyEntry = {
  item: string | null;
  percent: number | null;
  note: string | null;
};

/** Per-course detail page data. All fields can be null when missing. */
export type CourseDetail = {
  detailUrl: string | null;
  courseDescription: string | null;
  teachingGoal: string | null;
  gradingPolicy: GradingPolicyEntry[];
  textbook: string | null;
  referenceBooks: string | null;
  officeHour: string | null;
  syllabusUrl: string | null;
  detailedNote: string | null;
  teachers: Teacher[];
  teachingAssistants: { name: string }[];
  rawSections: Record<string, string>;
  fetchStatus:
    | "success"
    | "skipped"
    | "parse_error"
    | "http_error"
    | "not_found"
    | null;
  fetchedAt: string | null;
  parserVersion: string | null;
  errorMessage: string | null;
};

export type CourseWithDetails = {
  course: Course;
  detail: CourseDetail | null;
};

/** Search-form state, lifted into the URL so results are shareable. */
export type CourseSearchParams = {
  q?: string; // free text against name / code / teacher
  year?: number;
  semester?: 1 | 2;
  deptCode?: string;
  weekday?: number; // 1..7
  hasOpening?: boolean; // remaining > 0
  requiredOnly?: boolean;
  // Phase-2 tag-based filters
  englishTaught?: boolean;
  remote?: boolean;
  hideNoOnline?: boolean;
  hideManual?: boolean;
  hideNotCountGraduation?: boolean;
  restrictedOnly?: boolean;
  riskLevel?: "low" | "medium" | "high";
  limit?: number;
  offset?: number;
};

/**
 * Minimal course snapshot for client-side persistence (candidate pool /
 * schedule). The schedule page can't read SQLite directly, so we copy
 * just the fields the UI needs into localStorage at the moment the user
 * adds the course. Capacity / enrolled / remaining are intentionally
 * omitted — they go stale fast and the planner doesn't need them.
 */
export type StoredCourseSnapshot = {
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
  courseNameEn: string | null;
  teachers: Teacher[];
  credits: number | null;
  timeSlots: TimeSlot[];
  rawNote: string | null;
  tags: TagKey[];
  warnings: Warning[];
  rules: Rule[];
  riskLevel: TagLevel;
  deptName: string | null;
  requiredOrElective: string | null;
};

/** What the candidate-pool localStorage key holds. */
export type CandidateEntry = {
  year: number;
  semester: number;
  courseCode: string;
  addedAt: string; // ISO8601
  snapshot: StoredCourseSnapshot;
};
