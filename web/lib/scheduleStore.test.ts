import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetScheduleCacheForTests,
  addCourseToSchedule,
  addSnapshotToSchedule,
  clearSchedule,
  confirmCourse,
  getScheduleSnapshot,
  isCourseInSchedule,
  removeCourseFromSchedule,
  setScheduleMode,
  unconfirmCourse,
} from "./scheduleStore";
import type { Course, TimeSlot } from "./types";
import {
  installFakeWindow,
  uninstallFakeWindow,
  type FakeWindow,
} from "./testSetup/fakeWindow";

const STORAGE_KEY = "ccsp.schedule.v1";

let win: FakeWindow;

beforeEach(() => {
  win = installFakeWindow();
  __resetScheduleCacheForTests();
});

afterEach(() => {
  uninstallFakeWindow();
});

// ---------------------------------------------------------------------------
// Fixtures

function slot(weekday: number, periods: (string | number)[], room?: string): TimeSlot {
  return { weekday, periods: periods.map(String), classroom: room ?? null };
}

function makeCourse(
  code: string,
  slots: TimeSlot[] = [],
  opts: {
    year?: number;
    semester?: number;
    name?: string;
    credits?: number | null;
  } = {},
): Course {
  return {
    id: 0,
    year: opts.year ?? 114,
    semester: opts.semester ?? 1,
    courseCode: code,
    courseName: opts.name ?? `Course ${code}`,
    courseNameEn: null,
    requiredOrElective: null,
    creditsRaw: null,
    creditsLecture: null,
    creditsLab: null,
    creditsTotal: opts.credits ?? 3,
    deptCode: null,
    deptName: null,
    teachers: [],
    timeRaw: null,
    timeSlots: slots,
    capacity: null,
    enrolled: null,
    remaining: null,
    rawNote: null,
    courseProfileId: null,
    scrapedAt: "2026-01-01T00:00:00Z",
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
  };
}

// ---------------------------------------------------------------------------
// 1. localStorage safety

describe("scheduleStore — localStorage safety", () => {
  it("returns the empty state when localStorage has no data", () => {
    const s = getScheduleSnapshot();
    expect(s.courses).toEqual([]);
    expect(s.mode).toBe("planning");
    expect(s.version).toBe(1);
  });

  it("falls back to empty state on malformed JSON without crashing", () => {
    win.localStorage.setItem(STORAGE_KEY, "{not valid json");
    __resetScheduleCacheForTests();
    const s = getScheduleSnapshot();
    expect(s.courses).toEqual([]);
    expect(s.mode).toBe("planning");
  });

  it("normalizes a partially-shaped payload (missing fields)", () => {
    win.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "weird" }));
    __resetScheduleCacheForTests();
    const s = getScheduleSnapshot();
    expect(s.courses).toEqual([]);
    expect(s.mode).toBe("planning");
  });

  it("normalizes mode `official` from disk and ignores garbage", () => {
    win.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, mode: "official", courses: [] }),
    );
    __resetScheduleCacheForTests();
    expect(getScheduleSnapshot().mode).toBe("official");
  });
});

// ---------------------------------------------------------------------------
// 2. add / dedupe / cross-term

describe("scheduleStore — add / remove", () => {
  it("adds a planned course", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3, 4])]));
    const s = getScheduleSnapshot();
    expect(s.courses).toHaveLength(1);
    expect(s.courses[0].status).toBe("planned");
    expect(s.courses[0].snapshot.timeSlots[0].periods).toEqual(["3", "4"]);
  });

  it("dedupes the same (year, semester, courseCode)", () => {
    const c = makeCourse("0001", [slot(1, [3])]);
    addCourseToSchedule(c);
    addCourseToSchedule(c);
    expect(getScheduleSnapshot().courses).toHaveLength(1);
  });

  it("treats same courseCode in different terms as distinct", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])], { semester: 1 }));
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])], { semester: 2 }));
    expect(getScheduleSnapshot().courses).toHaveLength(2);
  });

  it("removes a course by full key", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])]));
    addCourseToSchedule(makeCourse("0002", [slot(2, [3])]));
    removeCourseFromSchedule({ year: 114, semester: 1, courseCode: "0001" });
    expect(getScheduleSnapshot().courses.map((c) => c.courseCode)).toEqual([
      "0002",
    ]);
  });

  it("isCourseInSchedule reflects current state", () => {
    expect(
      isCourseInSchedule({ year: 114, semester: 1, courseCode: "0001" }),
    ).toBe(false);
    addCourseToSchedule(makeCourse("0001"));
    expect(
      isCourseInSchedule({ year: 114, semester: 1, courseCode: "0001" }),
    ).toBe(true);
  });

  it("addSnapshotToSchedule stores a planned entry from a snapshot", () => {
    const course = makeCourse("0001", [slot(1, [3])]);
    addCourseToSchedule(course); // first round populates snapshot
    const snapshot = getScheduleSnapshot().courses[0].snapshot;
    clearSchedule();
    addSnapshotToSchedule(snapshot);
    expect(getScheduleSnapshot().courses).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. confirmCourse — mode-aware

describe("scheduleStore — confirmCourse", () => {
  it("planning mode: succeeds even with conflict", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3, 4])]));
    addCourseToSchedule(makeCourse("0002", [slot(1, [4])]));
    // confirm 0001 first, then 0002 — both should succeed in planning
    expect(confirmCourse({ year: 114, semester: 1, courseCode: "0001" }).ok).toBe(
      true,
    );
    expect(confirmCourse({ year: 114, semester: 1, courseCode: "0002" }).ok).toBe(
      true,
    );
  });

  it("official mode: rejects confirm if it conflicts with existing confirmed", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3, 4])], { name: "A" }));
    addCourseToSchedule(makeCourse("0002", [slot(1, [4])], { name: "B" }));
    // Confirm 0001 first while still in planning, then switch.
    confirmCourse({ year: 114, semester: 1, courseCode: "0001" });
    setScheduleMode("official");
    const r = confirmCourse({ year: 114, semester: 1, courseCode: "0002" });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "conflict") {
      expect(r.conflictsWith.map((c) => c.courseCode)).toEqual(["0001"]);
    }
    // Status should remain planned
    const e = getScheduleSnapshot().courses.find(
      (c) => c.courseCode === "0002",
    );
    expect(e?.status).toBe("planned");
  });

  it("official mode: succeeds when no conflict with confirmed", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])]));
    addCourseToSchedule(makeCourse("0002", [slot(2, [3])]));
    confirmCourse({ year: 114, semester: 1, courseCode: "0001" });
    setScheduleMode("official");
    expect(
      confirmCourse({ year: 114, semester: 1, courseCode: "0002" }).ok,
    ).toBe(true);
  });

  it("official mode: no-time course can be confirmed", () => {
    addCourseToSchedule(makeCourse("5013", [], { credits: 6 })); // 論文
    setScheduleMode("official");
    expect(
      confirmCourse({ year: 114, semester: 1, courseCode: "5013" }).ok,
    ).toBe(true);
  });

  it("returns not_found for missing key", () => {
    const r = confirmCourse({ year: 114, semester: 1, courseCode: "9999" });
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });

  it("unconfirmCourse demotes status back to planned", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])]));
    confirmCourse({ year: 114, semester: 1, courseCode: "0001" });
    unconfirmCourse({ year: 114, semester: 1, courseCode: "0001" });
    expect(getScheduleSnapshot().courses[0].status).toBe("planned");
  });
});

// ---------------------------------------------------------------------------
// 4. mode + clear

describe("scheduleStore — mode + clear", () => {
  it("setScheduleMode persists across reads", () => {
    setScheduleMode("official");
    expect(getScheduleSnapshot().mode).toBe("official");
    setScheduleMode("planning");
    expect(getScheduleSnapshot().mode).toBe("planning");
  });

  it("clearSchedule wipes courses but resets to planning mode", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])]));
    setScheduleMode("official");
    clearSchedule();
    const s = getScheduleSnapshot();
    expect(s.courses).toHaveLength(0);
    expect(s.mode).toBe("planning");
  });

  it("switching mode does not auto-remove existing confirmed courses", () => {
    addCourseToSchedule(makeCourse("0001", [slot(1, [3])]));
    addCourseToSchedule(makeCourse("0002", [slot(1, [3])])); // overlaps!
    confirmCourse({ year: 114, semester: 1, courseCode: "0001" });
    confirmCourse({ year: 114, semester: 1, courseCode: "0002" }); // succeeds in planning
    setScheduleMode("official");
    const confirmed = getScheduleSnapshot().courses.filter(
      (c) => c.status === "confirmed",
    );
    // Both stay confirmed even though they conflict — the user must
    // demote one manually.
    expect(confirmed.map((c) => c.courseCode).sort()).toEqual(["0001", "0002"]);
  });
});
