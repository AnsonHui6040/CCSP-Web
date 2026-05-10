import { describe, expect, it } from "vitest";
import {
  coursesConflict,
  findAllConflicts,
  findCourseConflicts,
  getOccupiedSlots,
  isSameCourse,
  normalizePeriod,
  normalizeWeekday,
  type CourseLike,
} from "./conflict";
import type { TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Fixture builders

let nextId = 1;
function course(
  name: string,
  slots: Array<[number | string, (string | number)[], string?]>,
  opts: { id?: number; credits?: number; code?: string } = {},
): CourseLike {
  return {
    id: opts.id ?? nextId++,
    courseCode: opts.code ?? name.replace(/\s+/g, "").slice(0, 4),
    courseName: name,
    credits: opts.credits,
    timeSlots: slots.map(([weekday, periods, classroom]) => ({
      weekday: weekday as number, // CourseLike accepts number|string via normalize
      periods: periods.map(String),
      classroom: classroom ?? null,
    })) as TimeSlot[],
  };
}

// ---------------------------------------------------------------------------
// 1. coursesConflict — basic cell math

describe("coursesConflict", () => {
  it("returns false for two courses with disjoint slots", () => {
    const a = course("A", [[1, ["3", "4"], "H101"]]);
    const b = course("B", [[2, ["3", "4"], "H101"]]);
    expect(coursesConflict(a, b)).toBe(false);
  });

  it("returns true when one cell overlaps", () => {
    const a = course("A", [[1, ["3", "4"]]]);
    const b = course("B", [[1, ["4", "5"]]]);
    expect(coursesConflict(a, b)).toBe(true);
  });

  it("returns false when one course has no time slots", () => {
    const thesis = course("碩士論文", []);
    const lecture = course("微積分", [[1, ["3", "4"]]]);
    expect(coursesConflict(thesis, lecture)).toBe(false);
    expect(coursesConflict(lecture, thesis)).toBe(false);
  });

  it("works across multi-slot courses where only one slot conflicts", () => {
    const a = course("A", [[1, ["3", "4"]], [3, ["5", "6"]]]);
    // Only Wed-5 overlaps with A's Wed-5,6
    const b = course("B", [[2, ["1", "2"]], [3, ["5"]]]);
    expect(coursesConflict(a, b)).toBe(true);
  });

  it("treats letter blocks (A,B) as their own cells", () => {
    const evening1 = course("E1", [[1, ["A", "B"]]]);
    const evening2 = course("E2", [[1, ["B"]]]);
    const day = course("D", [[1, ["1", "2"]]]);
    expect(coursesConflict(evening1, evening2)).toBe(true);
    expect(coursesConflict(evening1, day)).toBe(false);
  });

  it("ignores classroom — only (weekday, period) matters", () => {
    const a = course("A", [[1, ["3"], "H101"]]);
    const b = course("B", [[1, ["3"], "M999"]]);
    expect(coursesConflict(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. weekday/period normalization

describe("normalization", () => {
  it("accepts string weekday and parses to number", () => {
    expect(normalizeWeekday("3")).toBe(3);
    expect(normalizeWeekday(" 3 ")).toBe(3);
    expect(normalizeWeekday(3)).toBe(3);
  });

  it("rejects out-of-range weekdays", () => {
    expect(normalizeWeekday(0)).toBeNull();
    expect(normalizeWeekday(8)).toBeNull();
    expect(normalizeWeekday("abc")).toBeNull();
    expect(normalizeWeekday(null)).toBeNull();
    expect(normalizeWeekday(undefined)).toBeNull();
  });

  it("uppercases period letters and trims whitespace", () => {
    expect(normalizePeriod("a")).toBe("A");
    expect(normalizePeriod(" 7 ")).toBe("7");
    expect(normalizePeriod(undefined)).toBe("");
  });

  it("treats weekday given as numeric string identically to number", () => {
    const a = course("A", [[1, ["3"]]]);
    const b: CourseLike = {
      id: 999,
      courseCode: "X",
      courseName: "X",
      timeSlots: [{ weekday: "1" as unknown as number, periods: ["3"], classroom: null }],
    };
    expect(coursesConflict(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. findCourseConflicts — identity filtering

describe("findCourseConflicts", () => {
  it("returns the conflicting subset", () => {
    const target = course("Target", [[1, ["3", "4"]]]);
    const okay = course("OK", [[2, ["3", "4"]]]);
    const clash = course("Clash", [[1, ["4", "5"]]]);
    expect(findCourseConflicts(target, [okay, clash])).toEqual([clash]);
  });

  it("does not flag the target itself when it appears in the list (id match)", () => {
    const target = course("Self", [[1, ["3"]]], { id: 42 });
    const same: CourseLike = { ...target }; // same id, different reference
    const other = course("Other", [[1, ["3"]]]);
    expect(findCourseConflicts(target, [same, other])).toEqual([other]);
  });

  it("does not flag by reference equality even without ids", () => {
    const target: CourseLike = {
      courseCode: "0001",
      courseName: "X",
      timeSlots: [{ weekday: 1, periods: ["3"], classroom: null }],
    };
    expect(findCourseConflicts(target, [target])).toEqual([]);
  });

  it("returns empty array when target has no time", () => {
    const thesis = course("論文", []);
    const others = [course("A", [[1, ["3"]]]), course("B", [[2, ["4"]]])];
    expect(findCourseConflicts(thesis, others)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. findAllConflicts — pair enumeration

describe("findAllConflicts", () => {
  it("returns one entry per conflicting pair, with overlap cells", () => {
    const a = course("A", [[1, ["3", "4"]]]);
    const b = course("B", [[1, ["4", "5"]]]);
    const c = course("C", [[2, ["4"]]]);
    const conflicts = findAllConflicts([a, b, c]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].a).toBe(a);
    expect(conflicts[0].b).toBe(b);
    expect(conflicts[0].overlaps).toEqual([{ weekday: 1, period: "4" }]);
  });

  it("dedupes overlap cells when a course self-references the same cell twice", () => {
    const a = course("A", [[1, ["3"]], [1, ["3"]]]);
    const b = course("B", [[1, ["3"]]]);
    const conflicts = findAllConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlaps).toEqual([{ weekday: 1, period: "3" }]);
  });

  it("scales to multiple disjoint pairs", () => {
    const a = course("A", [[1, ["1"]]]);
    const b = course("B", [[1, ["1"]]]);
    const c = course("C", [[2, ["2"]]]);
    const d = course("D", [[2, ["2"]]]);
    const conflicts = findAllConflicts([a, b, c, d]);
    expect(conflicts).toHaveLength(2);
  });

  it("ignores duplicate course-id entries (would otherwise self-conflict)", () => {
    const same = course("S", [[1, ["3"]]], { id: 7 });
    const dupe: CourseLike = { ...same };
    expect(findAllConflicts([same, dupe])).toEqual([]);
  });

  it("returns empty for an empty list and for single-course list", () => {
    expect(findAllConflicts([])).toEqual([]);
    expect(findAllConflicts([course("A", [[1, ["3"]]])])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. getOccupiedSlots — flat grid view

describe("getOccupiedSlots", () => {
  it("maps each (weekday, period) to its courses", () => {
    const a = course("A", [[1, ["3", "4"], "H101"]]);
    const b = course("B", [[1, ["4"], "H102"]]);
    const occ = getOccupiedSlots([a, b]);
    // Cells: (1,3) [a only], (1,4) [a + b]
    expect(occ).toHaveLength(2);
    const cell14 = occ.find((s) => s.weekday === 1 && s.period === "4")!;
    expect(cell14.courses).toEqual([a, b]);
    expect(cell14.classroomByCourse.get(a)).toBe("H101");
    expect(cell14.classroomByCourse.get(b)).toBe("H102");
  });

  it("sorts output deterministically by (weekday, period)", () => {
    const a = course("A", [[3, ["7"]], [1, ["3"]]]);
    const b = course("B", [[2, ["A"]], [2, ["1"]]]);
    const occ = getOccupiedSlots([a, b]);
    expect(occ.map((s) => `${s.weekday}-${s.period}`)).toEqual([
      "1-3",
      "2-1",
      "2-A",
      "3-7",
    ]);
  });

  it("ignores courses with no time slots", () => {
    expect(getOccupiedSlots([course("論文", [])])).toEqual([]);
  });

  it("dedupes by course identity within a single cell", () => {
    const same = course("S", [[1, ["3"]], [1, ["3"]]], { id: 99 });
    const occ = getOccupiedSlots([same, { ...same }]); // duplicate by id
    const cell = occ.find((s) => s.weekday === 1 && s.period === "3")!;
    expect(cell.courses).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6. isSameCourse

describe("isSameCourse", () => {
  it("matches by reference", () => {
    const a = course("A", []);
    expect(isSameCourse(a, a)).toBe(true);
  });

  it("matches by id when both have ids", () => {
    expect(
      isSameCourse(course("A", [], { id: 1 }), course("B", [], { id: 1 })),
    ).toBe(true);
  });

  it("does not match by courseCode alone (could be different terms)", () => {
    const a: CourseLike = { courseCode: "0001", courseName: "A", timeSlots: [] };
    const b: CourseLike = { courseCode: "0001", courseName: "A", timeSlots: [] };
    expect(isSameCourse(a, b)).toBe(false);
  });
});
