/**
 * Pure conflict-analysis functions for the schedule planner.
 *
 * No React, no DOM, no DB — keep this layer testable in isolation. The UI
 * binds against `Course` from `./types`, but the algorithm only needs the
 * structural subset captured by `CourseLike`.
 *
 * Period strings are compared verbatim (after trim + uppercase) so that
 * "7" and "07" are treated as different cells; THU only emits one canonical
 * form, so this is intentional. Letter blocks (A, B, ...) work the same way.
 */

import type { TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Public types

/**
 * Structural shape any course-like object must satisfy to be analysed.
 * Keep this narrow — adding fields here makes the module harder to use
 * from tests / synthetic fixtures.
 */
export type CourseLike = {
  id?: number;
  courseCode: string;
  courseName: string;
  credits?: number;
  timeSlots: ReadonlyArray<TimeSlot>;
};

/** A pair of courses sharing at least one (weekday, period) cell. */
export type Conflict = {
  a: CourseLike;
  b: CourseLike;
  /** Cells where both courses are simultaneously scheduled. */
  overlaps: CellRef[];
};

/** A single grid cell + every course currently scheduled on it. */
export type OccupiedSlot = {
  weekday: number;
  period: string;
  /** Will have length ≥ 2 for cells with conflicts. */
  courses: CourseLike[];
  classroomByCourse: Map<CourseLike, string | null>;
};

export type CellRef = {
  weekday: number;
  period: string;
};

// ---------------------------------------------------------------------------
// Core API

/**
 * True iff `a` and `b` share at least one (weekday, period) cell.
 * Self-comparison rules are NOT applied here — pass distinct courses.
 *
 * Courses with no time slots (e.g., 論文, 實習) never conflict — caller
 * should treat them separately if it wants to flag "shares the day".
 */
export function coursesConflict(a: CourseLike, b: CourseLike): boolean {
  const aCells = cellsOf(a);
  if (aCells.size === 0) return false;
  for (const cell of iterCells(b)) {
    if (aCells.has(cell)) return true;
  }
  return false;
}

/**
 * Subset of `existingCourses` that conflict with `target`.
 *
 * Filters out the same course identity (`id` equality, then reference
 * equality) so that re-checking a course already on the schedule doesn't
 * report itself.
 */
export function findCourseConflicts(
  target: CourseLike,
  existingCourses: ReadonlyArray<CourseLike>,
): CourseLike[] {
  return existingCourses.filter(
    (c) => !isSameCourse(c, target) && coursesConflict(target, c),
  );
}

/**
 * Every conflicting pair in `courses`, with the cells they share.
 *
 * Pairs are unordered (each pair appears once). O(N²) which is fine for
 * the scale we expect (a personal schedule of < 30 courses, or a
 * candidate pool of < 200).
 */
export function findAllConflicts(
  courses: ReadonlyArray<CourseLike>,
): Conflict[] {
  const out: Conflict[] = [];
  // Pre-compute cell sets so the inner loop doesn't re-allocate.
  const cellSets = courses.map(cellsOf);
  for (let i = 0; i < courses.length; i++) {
    const aSet = cellSets[i];
    if (aSet.size === 0) continue;
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      if (isSameCourse(a, b)) continue;
      const overlaps = computeOverlaps(aSet, b);
      if (overlaps.length > 0) {
        out.push({ a, b, overlaps });
      }
    }
  }
  return out;
}

/**
 * Flat view of which courses occupy each grid cell.
 *
 * Useful for both rendering ("draw this cell with N courses stacked") and
 * conflict reporting ("which cells have > 1 course"). Output is sorted by
 * (weekday, period) for stable rendering.
 */
export function getOccupiedSlots(
  courses: ReadonlyArray<CourseLike>,
): OccupiedSlot[] {
  const map = new Map<string, OccupiedSlot>();
  for (const course of courses) {
    for (const slot of course.timeSlots) {
      const wd = normalizeWeekday(slot.weekday);
      if (wd === null) continue;
      const room = slot.classroom ?? null;
      for (const rawPeriod of slot.periods) {
        const period = normalizePeriod(rawPeriod);
        if (!period) continue;
        const key = cellKey(wd, period);
        let entry = map.get(key);
        if (!entry) {
          entry = {
            weekday: wd,
            period,
            courses: [],
            classroomByCourse: new Map(),
          };
          map.set(key, entry);
        }
        if (!entry.courses.some((c) => isSameCourse(c, course))) {
          entry.courses.push(course);
          entry.classroomByCourse.set(course, room);
        }
      }
    }
  }
  return Array.from(map.values()).sort(
    (x, y) =>
      x.weekday - y.weekday ||
      // String compare gives a stable order for letter blocks too.
      x.period.localeCompare(y.period),
  );
}

// ---------------------------------------------------------------------------
// Helpers (exported so tests can hit edge cases directly)

export function isSameCourse(a: CourseLike, b: CourseLike): boolean {
  if (a === b) return true;
  if (a.id !== undefined && b.id !== undefined && a.id === b.id) return true;
  return false;
}

export function normalizeWeekday(
  wd: number | string | null | undefined,
): number | null {
  if (wd === null || wd === undefined) return null;
  const n = typeof wd === "string" ? Number(wd.trim()) : wd;
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n as number);
  // Out-of-range values silently ignored — we never produce them, but
  // synthetic inputs from tests / fixtures could.
  return i >= 1 && i <= 7 ? i : null;
}

export function normalizePeriod(p: unknown): string {
  return String(p ?? "")
    .trim()
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Internals

function cellKey(weekday: number, period: string): string {
  return `${weekday}-${period}`;
}

function cellsOf(course: CourseLike): Set<string> {
  const out = new Set<string>();
  for (const cell of iterCells(course)) {
    out.add(cell);
  }
  return out;
}

function* iterCells(course: CourseLike): Iterable<string> {
  for (const slot of course.timeSlots) {
    const wd = normalizeWeekday(slot.weekday);
    if (wd === null) continue;
    for (const rawPeriod of slot.periods) {
      const period = normalizePeriod(rawPeriod);
      if (period) yield cellKey(wd, period);
    }
  }
}

function computeOverlaps(
  aCells: ReadonlySet<string>,
  b: CourseLike,
): CellRef[] {
  const overlaps: CellRef[] = [];
  const seen = new Set<string>();
  for (const slot of b.timeSlots) {
    const wd = normalizeWeekday(slot.weekday);
    if (wd === null) continue;
    for (const rawPeriod of slot.periods) {
      const period = normalizePeriod(rawPeriod);
      if (!period) continue;
      const k = cellKey(wd, period);
      if (aCells.has(k) && !seen.has(k)) {
        overlaps.push({ weekday: wd, period });
        seen.add(k);
      }
    }
  }
  return overlaps;
}
