import { describe, expect, it } from "vitest";
import {
  comparePeriod,
  computeFreePeriods,
  computeStats,
  PERIOD_ORDER,
  type StatsInput,
} from "./scheduleStats";
import type { TimeSlot } from "./types";

function slot(
  weekday: number,
  periods: (string | number)[],
  classroom: string | null = null,
): TimeSlot {
  return { weekday, periods: periods.map(String), classroom };
}

function statsCourse(opts: {
  status?: "planned" | "confirmed";
  credits?: number | null;
  slots?: TimeSlot[];
}): StatsInput {
  return {
    status: opts.status ?? "planned",
    credits: opts.credits ?? null,
    timeSlots: opts.slots ?? [],
  };
}

// ---------------------------------------------------------------------------
// 1. credit aggregation

describe("computeStats credits", () => {
  it("sums credits across courses", () => {
    const r = computeStats([
      statsCourse({ credits: 3, slots: [slot(1, [3])] }),
      statsCourse({ credits: 2, slots: [slot(2, [3])] }),
    ]);
    expect(r.totalCredits).toBe(5);
    expect(r.plannedCredits).toBe(5);
    expect(r.confirmedCredits).toBe(0);
  });

  it("splits credits by status", () => {
    const r = computeStats([
      statsCourse({ status: "confirmed", credits: 3, slots: [slot(1, [3])] }),
      statsCourse({ status: "planned", credits: 2, slots: [slot(2, [3])] }),
    ]);
    expect(r.confirmedCredits).toBe(3);
    expect(r.plannedCredits).toBe(2);
    expect(r.confirmedCourses).toBe(1);
    expect(r.plannedCourses).toBe(1);
  });

  it("treats null/undefined credits as 0 without crashing", () => {
    const r = computeStats([
      statsCourse({ credits: null, slots: [slot(1, [3])] }),
      statsCourse({ credits: 3, slots: [slot(2, [3])] }),
      statsCourse({ credits: undefined as unknown as number, slots: [slot(3, [3])] }),
    ]);
    expect(r.totalCredits).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. no-time courses

describe("computeStats no-time", () => {
  it("counts no-time courses and their credits separately", () => {
    const r = computeStats([
      statsCourse({ credits: 6, slots: [] }), // 論文
      statsCourse({ credits: 3, slots: [slot(1, [3])] }),
    ]);
    expect(r.noTimeCourses).toBe(1);
    expect(r.noTimeCredits).toBe(6);
    expect(r.totalCredits).toBe(9);
  });

  it("excludes no-time courses from dailyLoad", () => {
    const r = computeStats([
      statsCourse({ credits: 6, slots: [] }),
      statsCourse({ credits: 3, slots: [slot(1, [3])] }),
    ]);
    expect(r.dailyLoad).toHaveLength(1);
    expect(r.dailyLoad[0].weekday).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. dailyLoad

describe("dailyLoad", () => {
  it("counts each weekday separately", () => {
    const r = computeStats([
      statsCourse({ credits: 2, slots: [slot(1, [3, 4])] }),
      statsCourse({ credits: 2, slots: [slot(3, [5])] }),
    ]);
    expect(r.dailyLoad).toEqual([
      {
        weekday: 1,
        courseCount: 1,
        periodCount: 2,
        occupiedPeriods: ["3", "4"],
      },
      {
        weekday: 3,
        courseCount: 1,
        periodCount: 1,
        occupiedPeriods: ["5"],
      },
    ]);
  });

  it("dedupes overlapping periods within the same weekday", () => {
    // Course A: Mon 3,4. Course B: Mon 4,5. periodCount = 3 (3,4,5).
    const r = computeStats([
      statsCourse({ slots: [slot(1, [3, 4])] }),
      statsCourse({ slots: [slot(1, [4, 5])] }),
    ]);
    expect(r.dailyLoad[0].periodCount).toBe(3);
    expect(r.dailyLoad[0].courseCount).toBe(2);
    expect(r.dailyLoad[0].occupiedPeriods).toEqual(["3", "4", "5"]);
  });

  it("counts a course once per weekday even with multiple slots that day", () => {
    // Course with two slots on Mon: 1-2 and 5-6 — should only count once.
    const r = computeStats([
      statsCourse({ slots: [slot(1, [1, 2]), slot(1, [5, 6])] }),
    ]);
    expect(r.dailyLoad[0].courseCount).toBe(1);
    expect(r.dailyLoad[0].periodCount).toBe(4);
  });

  it("longestDay points to the day with most periods", () => {
    const r = computeStats([
      statsCourse({ slots: [slot(1, [3])] }),
      statsCourse({ slots: [slot(2, [3, 4, 5, 6])] }),
    ]);
    expect(r.longestDay?.weekday).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. freePeriods between first/last occupied of the day

describe("freePeriods", () => {
  it("returns gaps strictly between first and last occupied period", () => {
    expect(computeFreePeriods(["3", "4", "7", "8"])).toEqual(["5", "6"]);
  });

  it("returns empty for a day with one period", () => {
    expect(computeFreePeriods(["3"])).toEqual([]);
  });

  it("returns empty for a contiguous run", () => {
    expect(computeFreePeriods(["3", "4", "5"])).toEqual([]);
  });

  it("orders A,B after numeric periods", () => {
    expect(comparePeriod("13", "A")).toBeLessThan(0);
    expect(comparePeriod("A", "B")).toBeLessThan(0);
    expect(computeFreePeriods(["12", "B"])).toEqual(["13", "A"]);
  });

  it("flows through computeStats per weekday", () => {
    const r = computeStats([
      statsCourse({ slots: [slot(2, [3])] }),
      statsCourse({ slots: [slot(2, [7])] }),
    ]);
    const tue = r.freePeriods.find((d) => d.weekday === 2)!;
    expect(tue.freePeriodsBetweenFirstAndLast).toEqual(["4", "5", "6"]);
    expect(tue.count).toBe(3);
  });

  it("a day with a single class produces zero free periods", () => {
    const r = computeStats([statsCourse({ slots: [slot(5, [3])] })]);
    expect(r.freePeriods[0].count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. period order sanity

describe("PERIOD_ORDER", () => {
  it("has the expected 16 entries: 0..13 then A, B", () => {
    expect(PERIOD_ORDER).toHaveLength(16);
    expect(PERIOD_ORDER[0]).toBe("0");
    expect(PERIOD_ORDER[13]).toBe("13");
    expect(PERIOD_ORDER[14]).toBe("A");
    expect(PERIOD_ORDER[15]).toBe("B");
  });
});
