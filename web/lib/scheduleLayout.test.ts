import { describe, expect, it } from "vitest";
import {
  assignOverlapColumns,
  blocksOverlap,
  buildScheduleLayoutBlocks,
  getOverlapGroups,
} from "./scheduleLayout";
import type { Conflict } from "./conflict";
import type { StoredScheduleCourse } from "./scheduleStore";
import type { TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Fixture builders

function timeSlot(
  weekday: number,
  periods: (string | number)[],
  classroom: string | null = null,
): TimeSlot {
  return { weekday, periods: periods.map(String), classroom };
}

function entry(
  code: string,
  slots: TimeSlot[],
  opts: { year?: number; semester?: number; name?: string } = {},
): StoredScheduleCourse {
  return {
    courseCode: code,
    year: opts.year ?? 114,
    semester: opts.semester ?? 1,
    status: "planned",
    addedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    snapshot: {
      courseCode: code,
      year: opts.year ?? 114,
      semester: opts.semester ?? 1,
      courseName: opts.name ?? `Course ${code}`,
      courseNameEn: null,
      teachers: [],
      credits: 3,
      timeSlots: slots,
      rawNote: null,
      tags: [],
      warnings: [],
      rules: [],
      riskLevel: "low",
      deptName: null,
      requiredOrElective: null,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. consecutive-period merging

describe("buildScheduleLayoutBlocks — merging", () => {
  it("merges consecutive periods 3,4 into a single span-2 block", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(2, ["3", "4"], "M101")])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      weekday: 2,
      startPeriod: "3",
      endPeriod: "4",
      periodSpan: 2,
      periods: ["3", "4"],
      classroom: "M101",
    });
  });

  it("merges 7,8,9 into a single span-3 block", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(4, ["7", "8", "9"], "LAN013")])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].periodSpan).toBe(3);
    expect(blocks[0].endPeriod).toBe("9");
  });

  it("does NOT merge non-consecutive 3,5 (one block per period)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(2, ["3", "5"], "M101")])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].startPeriod).toBe("3");
    expect(blocks[0].periodSpan).toBe(1);
    expect(blocks[1].startPeriod).toBe("5");
    expect(blocks[1].periodSpan).toBe(1);
  });

  it("does NOT merge across days even when periods would be consecutive", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [
          timeSlot(1, ["3", "4"], "M101"),
          timeSlot(3, ["3", "4"], "M101"),
        ]),
      ],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.weekday).sort()).toEqual([1, 3]);
  });

  it("does NOT merge across different classrooms (Format-A: separate rooms)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [
          timeSlot(2, ["3", "4"], "M101"),
          timeSlot(2, ["5", "6"], "M102"),
        ]),
      ],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].classroom).toBe("M101");
    expect(blocks[0].periods).toEqual(["3", "4"]);
    expect(blocks[1].classroom).toBe("M102");
    expect(blocks[1].periods).toEqual(["5", "6"]);
  });

  it("DOES merge across separate slots with the same classroom (Format-B-like)", () => {
    // Same room, contiguous periods split across two TimeSlot rows.
    // Realistic case: importer emitted them as `[3,4]` then `[5,6]`
    // both with M101.
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [
          timeSlot(2, ["3", "4"], "M101"),
          timeSlot(2, ["5", "6"], "M101"),
        ]),
      ],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].periods).toEqual(["3", "4", "5", "6"]);
    expect(blocks[0].periodSpan).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 2. letter-period ordering

describe("buildScheduleLayoutBlocks — letter periods", () => {
  it("merges A,B as consecutive", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("E", [timeSlot(1, ["A", "B"], "C302")])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      startPeriod: "A",
      endPeriod: "B",
      periodSpan: 2,
    });
  });

  it("merges 13,A as consecutive", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("E", [timeSlot(1, ["13", "A"], "C302")])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startPeriod).toBe("13");
    expect(blocks[0].endPeriod).toBe("A");
    expect(blocks[0].periodSpan).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. multi-slot in one course → multiple blocks

describe("buildScheduleLayoutBlocks — multi-slot", () => {
  it("produces one block per (weekday, classroom, run)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [
          timeSlot(1, ["3", "4"], "M101"), // Mon 3-4 @ M101
          timeSlot(3, ["5", "6"], "M102"), // Wed 5-6 @ M102
          timeSlot(5, ["7"], "M103"),       // Fri 7 @ M103
        ]),
      ],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(3);
    const days = blocks.map((b) => b.weekday).sort();
    expect(days).toEqual([1, 3, 5]);
  });
});

// ---------------------------------------------------------------------------
// 4. no-time courses don't appear

describe("buildScheduleLayoutBlocks — no-time courses", () => {
  it("returns no blocks for a course with empty timeSlots", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("論文", [])],
      [],
      "planning",
    );
    expect(blocks).toEqual([]);
  });

  it("ignores no-time courses but keeps timed ones", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("論文", []),
        entry("微積分", [timeSlot(1, ["3", "4"])]),
      ],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].courseCode).toBe("微積分");
  });
});

// ---------------------------------------------------------------------------
// 5. conflict marking — mode-aware

describe("buildScheduleLayoutBlocks — conflict marking", () => {
  function makeConflict(
    a: StoredScheduleCourse,
    b: StoredScheduleCourse,
    overlaps: Array<{ weekday: number; period: string }>,
  ): Conflict {
    // Conflict expects CourseLike-shaped `a` and `b`; we only use the
    // overlap cells in scheduleLayout.ts.
    return {
      a: a as unknown as Conflict["a"],
      b: b as unknown as Conflict["b"],
      overlaps,
    };
  }

  it("marks a block as warning in planning mode when any cell overlaps", () => {
    const a = entry("A", [timeSlot(2, ["3", "4"])]);
    const b = entry("B", [timeSlot(2, ["4"])]);
    const conflict = makeConflict(a, b, [{ weekday: 2, period: "4" }]);
    const blocks = buildScheduleLayoutBlocks([a, b], [conflict], "planning");
    for (const block of blocks) {
      expect(block.isConflict).toBe(true);
      expect(block.conflictLevel).toBe("warning");
    }
  });

  it("marks a block as error in official mode when any cell overlaps", () => {
    const a = entry("A", [timeSlot(2, ["3", "4"])]);
    const b = entry("B", [timeSlot(2, ["4"])]);
    const conflict = makeConflict(a, b, [{ weekday: 2, period: "4" }]);
    const blocks = buildScheduleLayoutBlocks([a, b], [conflict], "official");
    for (const block of blocks) {
      expect(block.conflictLevel).toBe("error");
    }
  });

  it("does NOT mark unrelated blocks as conflict", () => {
    const a = entry("A", [timeSlot(2, ["3", "4"])]);
    const b = entry("B", [timeSlot(2, ["4"])]);
    const c = entry("C", [timeSlot(5, ["7"])]); // unrelated
    const conflict = makeConflict(a, b, [{ weekday: 2, period: "4" }]);
    const blocks = buildScheduleLayoutBlocks(
      [a, b, c],
      [conflict],
      "planning",
    );
    const cBlock = blocks.find((bl) => bl.courseCode === "C")!;
    expect(cBlock.isConflict).toBe(false);
    expect(cBlock.conflictLevel).toBe("none");
  });

  it("marks the whole merged block (3-4) when only one cell (4) is in conflict", () => {
    const a = entry("A", [timeSlot(2, ["3", "4"])]);
    const b = entry("B", [timeSlot(2, ["4"])]);
    const conflict = makeConflict(a, b, [{ weekday: 2, period: "4" }]);
    const blocks = buildScheduleLayoutBlocks([a, b], [conflict], "planning");
    const aBlock = blocks.find((bl) => bl.courseCode === "A")!;
    expect(aBlock.periodSpan).toBe(2);
    expect(aBlock.isConflict).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. deterministic ordering + identity keys

describe("buildScheduleLayoutBlocks — keys and ordering", () => {
  it("emits stable blockKey per (course, weekday, startPeriod, classroom)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(2, ["3", "4"], "M101")])],
      [],
      "planning",
    );
    expect(blocks[0].blockKey).toContain("114-1-A-2-3-M101");
  });

  it("sorts blocks by (weekday, startPeriod, courseCode)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("Z", [timeSlot(3, ["1"])]),
        entry("A", [timeSlot(1, ["5"])]),
        entry("M", [timeSlot(1, ["1"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.map((b) => `${b.weekday}-${b.startPeriod}-${b.courseCode}`)).toEqual([
      "1-1-M",
      "1-5-A",
      "3-1-Z",
    ]);
  });
});

// ---------------------------------------------------------------------------
// 7. P5B — overlap column assignment

describe("buildScheduleLayoutBlocks — overlap columns", () => {
  it("solo block fills full width: overlapCount=1", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(2, ["3", "4"])])],
      [],
      "planning",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      overlapIndex: 0,
      overlapCount: 1,
    });
    expect(blocks[0].overlapGroupId).toMatch(/^wd2-/);
  });

  it("two courses on the same period split into 2 columns", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3", "4"])]),
        entry("B", [timeSlot(2, ["3", "4"])]),
      ],
      [],
      "planning",
    );
    const a = blocks.find((b) => b.courseCode === "A")!;
    const b = blocks.find((b) => b.courseCode === "B")!;
    expect(a.overlapCount).toBe(2);
    expect(b.overlapCount).toBe(2);
    // distinct columns
    expect(new Set([a.overlapIndex, b.overlapIndex])).toEqual(new Set([0, 1]));
    expect(a.overlapGroupId).toBe(b.overlapGroupId);
  });

  it("partially overlapping courses (3-4 vs 4-5) → overlapCount=2", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3", "4"])]),
        entry("B", [timeSlot(2, ["4", "5"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.overlapCount === 2)).toBe(true);
    const a = blocks.find((b) => b.courseCode === "A")!;
    const b = blocks.find((b) => b.courseCode === "B")!;
    expect(new Set([a.overlapIndex, b.overlapIndex])).toEqual(new Set([0, 1]));
  });

  it("three simultaneous courses → overlapCount=3", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3"])]),
        entry("B", [timeSlot(2, ["3"])]),
        entry("C", [timeSlot(2, ["3"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.overlapCount === 3)).toBe(true);
    const idxs = blocks.map((b) => b.overlapIndex).sort();
    expect(idxs).toEqual([0, 1, 2]);
  });

  it("different weekdays do not share an overlap group", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(1, ["3"])]),
        entry("B", [timeSlot(2, ["3"])]),
      ],
      [],
      "planning",
    );
    const a = blocks.find((b) => b.courseCode === "A")!;
    const b = blocks.find((b) => b.courseCode === "B")!;
    expect(a.overlapGroupId).not.toBe(b.overlapGroupId);
    expect(a.overlapCount).toBe(1);
    expect(b.overlapCount).toBe(1);
  });

  it("non-overlapping blocks on the same day stay in separate groups", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3"])]),
        entry("B", [timeSlot(2, ["7"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.overlapCount === 1)).toBe(true);
    const a = blocks.find((b) => b.courseCode === "A")!;
    const b = blocks.find((b) => b.courseCode === "B")!;
    expect(a.overlapGroupId).not.toBe(b.overlapGroupId);
  });

  it("transitive overlap: A∼B and B∼C means A,B,C share a group", () => {
    // A: 1-2, B: 2-3, C: 3-4 — A and C don't directly overlap but B
    // bridges them. Spec §4 explicitly requires same-group treatment.
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["1", "2"])]),
        entry("B", [timeSlot(2, ["2", "3"])]),
        entry("C", [timeSlot(2, ["3", "4"])]),
      ],
      [],
      "planning",
    );
    const groupIds = new Set(blocks.map((b) => b.overlapGroupId));
    expect(groupIds.size).toBe(1);
    // Interval coloring: A col 0, B col 1, C col 0 (reuse)
    expect(blocks.every((b) => b.overlapCount === 2)).toBe(true);
  });

  it("column reuse: A 1-2, B 2-3, C 4-5 — C lands in its own group", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["1", "2"])]),
        entry("B", [timeSlot(2, ["2", "3"])]),
        entry("C", [timeSlot(2, ["4", "5"])]),
      ],
      [],
      "planning",
    );
    const a = blocks.find((b) => b.courseCode === "A")!;
    const b = blocks.find((b) => b.courseCode === "B")!;
    const c = blocks.find((b) => b.courseCode === "C")!;
    expect(a.overlapCount).toBe(2);
    expect(b.overlapCount).toBe(2);
    expect(c.overlapCount).toBe(1); // its own group → full width
    expect(c.overlapGroupId).not.toBe(a.overlapGroupId);
  });

  it("A/B letter-period overlap is detected (A vs A,B)", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("X", [timeSlot(1, ["A"])]),
        entry("Y", [timeSlot(1, ["A", "B"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.overlapCount === 2)).toBe(true);
  });

  it("13/A consecutive blocks overlap correctly", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("X", [timeSlot(1, ["13", "A"])]),
        entry("Y", [timeSlot(1, ["A"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.overlapCount === 2)).toBe(true);
  });

  it("conflictLevel is unaffected by overlap layout", () => {
    // Two courses that overlap on cells but have NO Conflict row
    // (synthetic; real flow always emits conflicts when cells overlap).
    // Verifies conflictLevel stays "none" if conflicts list is empty.
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3"])]),
        entry("B", [timeSlot(2, ["3"])]),
      ],
      [],
      "planning",
    );
    expect(blocks.every((b) => b.conflictLevel === "none")).toBe(true);
    expect(blocks.every((b) => b.overlapCount === 2)).toBe(true);
  });

  it("conflictLevel = error in official mode, layout still computes", () => {
    const a = entry("A", [timeSlot(2, ["3"])]);
    const b = entry("B", [timeSlot(2, ["3"])]);
    const conflicts: Conflict[] = [
      {
        a: a as unknown as Conflict["a"],
        b: b as unknown as Conflict["b"],
        overlaps: [{ weekday: 2, period: "3" }],
      },
    ];
    const blocks = buildScheduleLayoutBlocks([a, b], conflicts, "official");
    expect(blocks.every((bl) => bl.conflictLevel === "error")).toBe(true);
    expect(blocks.every((bl) => bl.overlapCount === 2)).toBe(true);
  });

  it("no-time courses still produce no blocks regardless of overlap pass", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("論文", []), entry("實習", [])],
      [],
      "planning",
    );
    expect(blocks).toEqual([]);
  });

  it("overlap pass is deterministic across runs", () => {
    const courses = [
      entry("Z", [timeSlot(2, ["3", "4"])]),
      entry("A", [timeSlot(2, ["3", "4"])]),
      entry("M", [timeSlot(2, ["4", "5"])]),
    ];
    const r1 = buildScheduleLayoutBlocks(courses, [], "planning");
    const r2 = buildScheduleLayoutBlocks(courses, [], "planning");
    expect(r1.map((b) => `${b.courseCode}/${b.overlapIndex}/${b.overlapCount}`)).toEqual(
      r2.map((b) => `${b.courseCode}/${b.overlapIndex}/${b.overlapCount}`),
    );
  });
});

// ---------------------------------------------------------------------------
// 8. helper exports

describe("blocksOverlap / getOverlapGroups", () => {
  it("blocksOverlap returns false for same-instance / different weekday", () => {
    const blocks = buildScheduleLayoutBlocks(
      [entry("A", [timeSlot(2, ["3"])])],
      [],
      "planning",
    );
    const a = blocks[0];
    expect(blocksOverlap(a, a)).toBe(false);

    const blocks2 = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(1, ["3"])]),
        entry("B", [timeSlot(2, ["3"])]),
      ],
      [],
      "planning",
    );
    expect(blocksOverlap(blocks2[0], blocks2[1])).toBe(false);
  });

  it("getOverlapGroups returns one group per connected component", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["1", "2"])]),
        entry("B", [timeSlot(2, ["2", "3"])]),
        entry("C", [timeSlot(2, ["7"])]),
      ],
      [],
      "planning",
    );
    const groups = getOverlapGroups(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });

  it("assignOverlapColumns is idempotent on already-assigned input", () => {
    const blocks = buildScheduleLayoutBlocks(
      [
        entry("A", [timeSlot(2, ["3"])]),
        entry("B", [timeSlot(2, ["3"])]),
      ],
      [],
      "planning",
    );
    const second = assignOverlapColumns(blocks);
    expect(second.map((b) => `${b.courseCode}-${b.overlapIndex}-${b.overlapCount}`)).toEqual(
      blocks.map((b) => `${b.courseCode}-${b.overlapIndex}-${b.overlapCount}`),
    );
  });
});
