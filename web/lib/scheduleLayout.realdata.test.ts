// Smoke test against the real dept-100 fixture courses (0001 + 0006)
// scraped from THU. Catches regressions where the layout pipeline
// passes synthetic-input tests but breaks on real-shape data.
import { describe, expect, it } from "vitest";
import { buildScheduleLayoutBlocks } from "./scheduleLayout";
import type { Conflict } from "./conflict";
import type { StoredScheduleCourse } from "./scheduleStore";

const make = (
  code: string,
  name: string,
  slots: Array<{ weekday: number; periods: string[]; classroom: string }>,
): StoredScheduleCourse => ({
  courseCode: code,
  year: 114,
  semester: 1,
  status: "planned",
  addedAt: "",
  updatedAt: "",
  snapshot: {
    courseCode: code,
    year: 114,
    semester: 1,
    courseName: name,
    courseNameEn: null,
    teachers: [],
    credits: 3,
    timeSlots: slots,
    rawNote: null,
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
    deptName: "文學院",
    requiredOrElective: "選修",
  },
});

describe("P5B real-data smoke (dept 100: 0001 + 0006)", () => {
  it("partial overlap on (4,8) and (4,9) → 2 columns, side-by-side", () => {
    const courses: StoredScheduleCourse[] = [
      make("0001", "口述歷史製作", [
        { weekday: 4, periods: ["7", "8", "9"], classroom: "LAN013" },
      ]),
      make("0006", "聲入其境", [
        { weekday: 4, periods: ["8", "9"], classroom: "C118" },
      ]),
    ];
    const conflicts: Conflict[] = [
      {
        a: courses[0] as unknown as Conflict["a"],
        b: courses[1] as unknown as Conflict["b"],
        overlaps: [
          { weekday: 4, period: "8" },
          { weekday: 4, period: "9" },
        ],
      },
    ];

    const planning = buildScheduleLayoutBlocks(courses, conflicts, "planning");
    expect(planning).toHaveLength(2);

    const a = planning.find((b) => b.courseCode === "0001")!;
    const b = planning.find((b) => b.courseCode === "0006")!;

    // Both blocks share an overlap group (transitively connected via 8,9).
    expect(a.overlapGroupId).toBe(b.overlapGroupId);
    expect(a.overlapCount).toBe(2);
    expect(b.overlapCount).toBe(2);
    expect(new Set([a.overlapIndex, b.overlapIndex])).toEqual(new Set([0, 1]));

    // Conflict marking still works.
    expect(a.conflictLevel).toBe("warning");
    expect(b.conflictLevel).toBe("warning");

    // 0001's block is the merged 7-9 (span 3); 0006 is 8-9 (span 2).
    expect(a.startPeriod).toBe("7");
    expect(a.endPeriod).toBe("9");
    expect(a.periodSpan).toBe(3);
    expect(b.startPeriod).toBe("8");
    expect(b.endPeriod).toBe("9");
    expect(b.periodSpan).toBe(2);

    // In official mode, both upgrade to error.
    const official = buildScheduleLayoutBlocks(courses, conflicts, "official");
    expect(official.every((bl) => bl.conflictLevel === "error")).toBe(true);
    // Same overlap layout regardless of mode.
    expect(official.find((bl) => bl.courseCode === "0001")!.overlapCount).toBe(2);
  });

  it("removing one course restores full-width single-block layout", () => {
    const courses: StoredScheduleCourse[] = [
      make("0001", "口述歷史製作", [
        { weekday: 4, periods: ["7", "8", "9"], classroom: "LAN013" },
      ]),
    ];
    const blocks = buildScheduleLayoutBlocks(courses, [], "planning");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].overlapCount).toBe(1);
    expect(blocks[0].overlapIndex).toBe(0);
    expect(blocks[0].conflictLevel).toBe("none");
  });
});
