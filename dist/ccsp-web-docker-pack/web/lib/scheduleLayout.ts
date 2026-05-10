/**
 * Display-layer transform for the weekly schedule grid.
 *
 * Takes the *persisted* schedule courses + the conflict pairs that
 * `findAllConflicts` produced, and returns a flat list of "display
 * blocks" — one rectangle per (course, weekday, classroom, contiguous
 * period run). Each block carries its grid-row span so the WeeklyGrid
 * can render it via CSS `grid-row: span N` instead of duplicating per
 * cell.
 *
 * Pure: no React, no DOM. Conflict detection is NOT recomputed here —
 * we trust `conflicts` and only use them to mark blocks. This keeps
 * the conflict layer single-sourced in `conflict.ts`.
 */

import type { Conflict } from "./conflict";
import { snapshotKey } from "./courseSnapshot";
import { PERIOD_ORDER } from "./scheduleStats";
import type {
  ScheduleMode,
  StoredScheduleCourse,
} from "./scheduleStore";

export type ConflictLevel = "none" | "warning" | "error";

export type ScheduleDisplayBlock = {
  /** Stable id for React keys: `${year}-${semester}-${courseCode}-${weekday}-${startPeriod}-${classroom?}`. */
  blockKey: string;
  /** Course identity key, same as `snapshotKey()`. */
  courseKey: string;
  courseCode: string;

  weekday: number;
  startPeriod: string;
  endPeriod: string;
  /** Number of consecutive periods this block covers. >=1. */
  periodSpan: number;
  /** Periods covered, in PERIOD_ORDER. Length === periodSpan. */
  periods: string[];
  classroom: string | null;

  /** The persisted course this block belongs to. */
  course: StoredScheduleCourse;

  isConflict: boolean;
  conflictLevel: ConflictLevel;

  // ---------------------------------------------------------------------
  // Side-by-side layout fields (assigned by `assignOverlapColumns`).
  //
  // - `overlapGroupId`: blocks transitively connected by period overlap
  //   share the same group. A solo block has its own group (`overlapCount=1`).
  // - `overlapIndex`: this block's column within the group (0..count-1).
  // - `overlapCount`: number of columns the group uses; drives the
  //   block's CSS width: `width = 100% / overlapCount`.
  overlapGroupId: string;
  overlapIndex: number;
  overlapCount: number;
};


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildScheduleLayoutBlocks(
  courses: ReadonlyArray<StoredScheduleCourse>,
  conflicts: ReadonlyArray<Conflict>,
  mode: ScheduleMode,
): ScheduleDisplayBlock[] {
  const conflictCells = collectConflictCells(conflicts);
  const blocks: ScheduleDisplayBlock[] = [];

  for (const course of courses) {
    const courseKey = snapshotKey(course);
    const groups = groupPeriodsByDayAndClassroom(course);

    for (const group of groups.values()) {
      // Sort the group's periods by canonical PERIOD_ORDER index.
      const sortedIdx = Array.from(group.periodIndices).sort((a, b) => a - b);
      if (sortedIdx.length === 0) continue;

      // Walk consecutive runs (delta === 1).
      let runStart = 0;
      for (let i = 1; i <= sortedIdx.length; i++) {
        const isBoundary =
          i === sortedIdx.length || sortedIdx[i] !== sortedIdx[i - 1] + 1;
        if (!isBoundary) continue;

        const runIndices = sortedIdx.slice(runStart, i);
        const runPeriods = runIndices.map((idx) => PERIOD_ORDER[idx]);
        const isConflict = runPeriods.some((p) =>
          conflictCells.has(cellKey(group.weekday, p)),
        );

        blocks.push({
          blockKey:
            `${courseKey}-${group.weekday}-${runPeriods[0]}-${group.classroom ?? ""}`,
          courseKey,
          courseCode: course.courseCode,
          weekday: group.weekday,
          startPeriod: runPeriods[0],
          endPeriod: runPeriods[runPeriods.length - 1],
          periodSpan: runPeriods.length,
          periods: runPeriods,
          classroom: group.classroom,
          course,
          isConflict,
          conflictLevel: !isConflict
            ? "none"
            : mode === "official"
              ? "error"
              : "warning",
          // Filled in by assignOverlapColumns below.
          overlapGroupId: "",
          overlapIndex: 0,
          overlapCount: 1,
        });
        runStart = i;
      }
    }
  }

  // Stable order: weekday, then start period, then course code. Keeps
  // React reconciliation happy and makes test assertions deterministic.
  blocks.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    const ai = PERIOD_ORDER.indexOf(a.startPeriod as (typeof PERIOD_ORDER)[number]);
    const bi = PERIOD_ORDER.indexOf(b.startPeriod as (typeof PERIOD_ORDER)[number]);
    if (ai !== bi) return ai - bi;
    return a.courseCode.localeCompare(b.courseCode);
  });

  return assignOverlapColumns(blocks);
}


// ---------------------------------------------------------------------------
// Overlap layout
// ---------------------------------------------------------------------------

/**
 * Two blocks "overlap" when they share a weekday AND any period(s).
 * Pure: no React, no DOM. Exported so tests can hit it directly.
 */
export function blocksOverlap(
  a: ScheduleDisplayBlock,
  b: ScheduleDisplayBlock,
): boolean {
  if (a === b) return false;
  if (a.weekday !== b.weekday) return false;
  const aStart = startIdx(a);
  const aEnd = endIdx(a);
  const bStart = startIdx(b);
  const bEnd = endIdx(b);
  if (aStart < 0 || bStart < 0) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Group `blocks` per weekday into transitively-overlapping clusters.
 * Solo blocks become a one-element group. Empty input → empty output.
 */
export function getOverlapGroups(
  blocks: ReadonlyArray<ScheduleDisplayBlock>,
): ScheduleDisplayBlock[][] {
  const byWeekday = new Map<number, ScheduleDisplayBlock[]>();
  for (const b of blocks) {
    let day = byWeekday.get(b.weekday);
    if (!day) {
      day = [];
      byWeekday.set(b.weekday, day);
    }
    day.push(b);
  }

  const groups: ScheduleDisplayBlock[][] = [];
  // Process weekdays in ascending order so the resulting groups are
  // deterministic across runs.
  const weekdays = Array.from(byWeekday.keys()).sort((a, b) => a - b);
  for (const wd of weekdays) {
    const dayBlocks = byWeekday.get(wd)!;
    groups.push(...connectedComponents(dayBlocks));
  }
  return groups;
}

/**
 * Assign `overlapGroupId` / `overlapIndex` / `overlapCount` to each
 * block. Uses transitive connected-components per weekday to define
 * groups, then per-group interval coloring to assign columns:
 *
 *   sort by startPeriod;
 *   for each block, place it in the leftmost column whose latest
 *   occupant ends *before* this block starts.
 *
 * Solo (non-overlapping) blocks end up in singleton groups with
 * `overlapCount = 1` so they fill the full day-column.
 */
export function assignOverlapColumns(
  blocks: ReadonlyArray<ScheduleDisplayBlock>,
): ScheduleDisplayBlock[] {
  type Layout = { groupId: string; index: number; count: number };
  const layoutByKey = new Map<string, Layout>();

  const groups = getOverlapGroups(blocks);
  groups.forEach((group, gi) => {
    const groupId = `wd${group[0].weekday}-g${gi}`;

    // Sort by startIdx, then by longer span first (slightly better
    // interval-coloring outcomes when ties exist).
    const sorted = [...group].sort((a, b) => {
      const ai = startIdx(a);
      const bi = startIdx(b);
      if (ai !== bi) return ai - bi;
      const aSpan = endIdx(a) - ai;
      const bSpan = endIdx(b) - bi;
      if (aSpan !== bSpan) return bSpan - aSpan;
      return a.courseCode.localeCompare(b.courseCode);
    });

    const columnEnds: number[] = []; // last `endIdx` per column
    const colByKey = new Map<string, number>();

    for (const b of sorted) {
      const start = startIdx(b);
      let col = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] < start) {
          col = c;
          break;
        }
      }
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(-1);
      }
      columnEnds[col] = endIdx(b);
      colByKey.set(b.blockKey, col);
    }

    const count = columnEnds.length;
    for (const b of group) {
      layoutByKey.set(b.blockKey, {
        groupId,
        index: colByKey.get(b.blockKey) ?? 0,
        count,
      });
    }
  });

  return blocks.map((b) => {
    const layout = layoutByKey.get(b.blockKey);
    if (!layout) {
      return { ...b, overlapGroupId: `wd${b.weekday}-solo`, overlapIndex: 0, overlapCount: 1 };
    }
    return {
      ...b,
      overlapGroupId: layout.groupId,
      overlapIndex: layout.index,
      overlapCount: layout.count,
    };
  });
}


// ---------------------------------------------------------------------------
// internals (overlap)

function connectedComponents(
  dayBlocks: ScheduleDisplayBlock[],
): ScheduleDisplayBlock[][] {
  const n = dayBlocks.length;
  if (n === 0) return [];
  // Union-find. Quadratic adjacency check is fine — N is tiny per day.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (blocksOverlap(dayBlocks[i], dayBlocks[j])) union(i, j);
    }
  }

  const byRoot = new Map<number, ScheduleDisplayBlock[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let bucket = byRoot.get(r);
    if (!bucket) {
      bucket = [];
      byRoot.set(r, bucket);
    }
    bucket.push(dayBlocks[i]);
  }
  // Order groups by their earliest startIdx so output is deterministic.
  const groups = Array.from(byRoot.values());
  groups.sort((a, b) => {
    const am = Math.min(...a.map(startIdx));
    const bm = Math.min(...b.map(startIdx));
    return am - bm;
  });
  return groups;
}

function startIdx(b: ScheduleDisplayBlock): number {
  return PERIOD_ORDER.indexOf(b.startPeriod as (typeof PERIOD_ORDER)[number]);
}

function endIdx(b: ScheduleDisplayBlock): number {
  return PERIOD_ORDER.indexOf(b.endPeriod as (typeof PERIOD_ORDER)[number]);
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PeriodGroup = {
  weekday: number;
  classroom: string | null;
  /** Indices into PERIOD_ORDER (so consecutive-detection is just `+1`). */
  periodIndices: Set<number>;
};

function groupPeriodsByDayAndClassroom(
  course: StoredScheduleCourse,
): Map<string, PeriodGroup> {
  const groups = new Map<string, PeriodGroup>();
  for (const slot of course.snapshot.timeSlots) {
    const wd = normalizeWeekday(slot.weekday);
    if (wd === null) continue;
    const room = slot.classroom ?? null;
    const key = `${wd}|${room ?? "∅"}`;
    let group = groups.get(key);
    if (!group) {
      group = { weekday: wd, classroom: room, periodIndices: new Set() };
      groups.set(key, group);
    }
    for (const raw of slot.periods) {
      const np = normalizePeriod(raw);
      const idx = PERIOD_ORDER.indexOf(np as (typeof PERIOD_ORDER)[number]);
      if (idx >= 0) group.periodIndices.add(idx);
    }
  }
  return groups;
}

function collectConflictCells(
  conflicts: ReadonlyArray<Conflict>,
): Set<string> {
  const set = new Set<string>();
  for (const c of conflicts) {
    for (const cell of c.overlaps) {
      set.add(cellKey(cell.weekday, cell.period));
    }
  }
  return set;
}

function cellKey(weekday: number, period: string): string {
  return `${weekday}-${period}`;
}

function normalizeWeekday(wd: number | string): number | null {
  const n = typeof wd === "string" ? Number(wd.trim()) : wd;
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n as number);
  return i >= 1 && i <= 7 ? i : null;
}

function normalizePeriod(p: unknown): string {
  return String(p ?? "").trim().toUpperCase();
}
