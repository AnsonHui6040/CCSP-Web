/**
 * Pure statistics over a planned schedule.
 *
 * No React, no DOM, no DB. Input is a plain list of "stat-able" courses;
 * the schedule store's items satisfy `StatsInput` shape.
 */

import type { TimeSlot } from "./types";
import { normalizePeriod, normalizeWeekday } from "./conflict";

export const PERIOD_ORDER = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "A",
  "B",
] as const;

export type Period = (typeof PERIOD_ORDER)[number];

export type ScheduleCourseStatus = "planned" | "confirmed";

/** Minimum a course must expose to be counted by these stats. */
export type StatsInput = {
  status: ScheduleCourseStatus;
  credits: number | null;
  timeSlots: ReadonlyArray<TimeSlot>;
};

export type DailyLoad = {
  weekday: number;
  courseCount: number;
  periodCount: number;
  occupiedPeriods: string[];
};

export type DailyFreePeriods = {
  weekday: number;
  freePeriodsBetweenFirstAndLast: string[];
  count: number;
};

export type ScheduleStats = {
  totalCourses: number;
  totalCredits: number;
  plannedCourses: number;
  confirmedCourses: number;
  plannedCredits: number;
  confirmedCredits: number;
  noTimeCourses: number;
  noTimeCredits: number;
  /** One per weekday that has any course (1..7), sorted ascending. */
  dailyLoad: DailyLoad[];
  /** Mirrors `dailyLoad` weekdays (one entry per same weekday). */
  freePeriods: DailyFreePeriods[];
  /** The DailyLoad entry with the most occupied periods, if any. */
  longestDay?: DailyLoad;
};

// ---------------------------------------------------------------------------
// Public API

export function computeStats(courses: ReadonlyArray<StatsInput>): ScheduleStats {
  let totalCredits = 0;
  let plannedCount = 0;
  let confirmedCount = 0;
  let plannedCredits = 0;
  let confirmedCredits = 0;
  let noTimeCount = 0;
  let noTimeCredits = 0;

  // weekday -> set of periods, weekday -> count of courses present
  const periodsByDay = new Map<number, Set<string>>();
  const coursesByDay = new Map<number, number>();

  for (const c of courses) {
    const credits = sumCredits(c.credits);
    totalCredits += credits;

    if (c.status === "planned") {
      plannedCount += 1;
      plannedCredits += credits;
    } else if (c.status === "confirmed") {
      confirmedCount += 1;
      confirmedCredits += credits;
    }

    const slots = c.timeSlots ?? [];
    if (slots.length === 0) {
      noTimeCount += 1;
      noTimeCredits += credits;
      continue;
    }

    const courseDays = new Set<number>();
    for (const slot of slots) {
      const wd = normalizeWeekday(slot.weekday);
      if (wd === null) continue;
      let bucket = periodsByDay.get(wd);
      if (!bucket) {
        bucket = new Set<string>();
        periodsByDay.set(wd, bucket);
      }
      for (const rawP of slot.periods) {
        const p = normalizePeriod(rawP);
        if (p) bucket.add(p);
      }
      courseDays.add(wd);
    }
    for (const day of courseDays) {
      coursesByDay.set(day, (coursesByDay.get(day) ?? 0) + 1);
    }
  }

  const sortedDays = Array.from(periodsByDay.keys()).sort((a, b) => a - b);

  const dailyLoad: DailyLoad[] = sortedDays.map((wd) => {
    const set = periodsByDay.get(wd)!;
    const occupiedPeriods = Array.from(set).sort(comparePeriod);
    return {
      weekday: wd,
      courseCount: coursesByDay.get(wd) ?? 0,
      periodCount: occupiedPeriods.length,
      occupiedPeriods,
    };
  });

  const freePeriods: DailyFreePeriods[] = dailyLoad.map((d) => {
    const free = computeFreePeriods(d.occupiedPeriods);
    return {
      weekday: d.weekday,
      freePeriodsBetweenFirstAndLast: free,
      count: free.length,
    };
  });

  const longestDay = dailyLoad.reduce<DailyLoad | undefined>((best, cur) => {
    if (!best || cur.periodCount > best.periodCount) return cur;
    return best;
  }, undefined);

  return {
    totalCourses: courses.length,
    totalCredits,
    plannedCourses: plannedCount,
    confirmedCourses: confirmedCount,
    plannedCredits,
    confirmedCredits,
    noTimeCourses: noTimeCount,
    noTimeCredits,
    dailyLoad,
    freePeriods,
    longestDay,
  };
}

// ---------------------------------------------------------------------------
// Helpers (exported for unit tests)

export function comparePeriod(a: string, b: string): number {
  const ai = PERIOD_ORDER.indexOf(a as Period);
  const bi = PERIOD_ORDER.indexOf(b as Period);
  // Unknown periods (shouldn't happen with our data) sort to the end but
  // remain stable amongst themselves.
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

/**
 * Free periods strictly between the first and last occupied period of
 * the day. Returns [] when the day has 0 or 1 occupied periods.
 */
export function computeFreePeriods(occupiedPeriods: string[]): string[] {
  if (occupiedPeriods.length < 2) return [];
  const sorted = [...occupiedPeriods].sort(comparePeriod);
  const firstIdx = PERIOD_ORDER.indexOf(sorted[0] as Period);
  const lastIdx = PERIOD_ORDER.indexOf(sorted[sorted.length - 1] as Period);
  if (firstIdx === -1 || lastIdx === -1 || lastIdx <= firstIdx) return [];
  const occupied = new Set(sorted);
  const out: string[] = [];
  for (let i = firstIdx + 1; i < lastIdx; i++) {
    const p = PERIOD_ORDER[i];
    if (!occupied.has(p)) out.push(p);
  }
  return out;
}

function sumCredits(credits: number | null | undefined): number {
  return typeof credits === "number" && Number.isFinite(credits) ? credits : 0;
}
