import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetCandidatesCacheForTests,
  addCandidate,
  clearCandidates,
  getCandidates,
  isCandidate,
  removeCandidate,
} from "./candidatePoolStore";
import type { Course } from "@/lib/types";
import {
  installFakeWindow,
  uninstallFakeWindow,
  type FakeWindow,
} from "@/lib/testSetup/fakeWindow";

const STORAGE_KEY_V2 = "ccsp.candidates.v2";
const STORAGE_KEY_V1 = "ccsp.candidates.v1";

let win: FakeWindow;

beforeEach(() => {
  win = installFakeWindow();
  __resetCandidatesCacheForTests();
});

afterEach(() => uninstallFakeWindow());

function makeCourse(code: string, year = 114, sem = 1): Course {
  return {
    id: 0,
    year,
    semester: sem,
    courseCode: code,
    courseName: `Course ${code}`,
    courseNameEn: null,
    requiredOrElective: null,
    creditsRaw: null,
    creditsLecture: null,
    creditsLab: null,
    creditsTotal: 3,
    deptCode: null,
    deptName: null,
    teachers: [],
    timeRaw: null,
    timeSlots: [],
    capacity: null,
    enrolled: null,
    remaining: null,
    rawNote: null,
    courseProfileId: null,
    scrapedAt: "",
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
  };
}

describe("candidatePoolStore — safety", () => {
  it("returns empty list when storage is empty", () => {
    expect(getCandidates()).toEqual([]);
  });

  it("ignores stale ccsp.candidates.v1 data (different key)", () => {
    win.localStorage.setItem(
      STORAGE_KEY_V1,
      JSON.stringify([{ courseCode: "0001", year: 114, semester: 1 }]),
    );
    __resetCandidatesCacheForTests();
    expect(getCandidates()).toEqual([]);
  });

  it("falls back to empty on malformed v2 JSON without crashing", () => {
    win.localStorage.setItem(STORAGE_KEY_V2, "{not valid json");
    __resetCandidatesCacheForTests();
    expect(getCandidates()).toEqual([]);
  });

  it("filters out malformed entries (missing required fields)", () => {
    win.localStorage.setItem(
      STORAGE_KEY_V2,
      JSON.stringify([
        { courseCode: "0001" }, // missing year/semester/snapshot
        null,
        { year: 114, semester: 1, courseCode: "0002", snapshot: { courseCode: "0002" } },
      ]),
    );
    __resetCandidatesCacheForTests();
    const items = getCandidates();
    expect(items).toHaveLength(1);
    expect(items[0].courseCode).toBe("0002");
  });
});

describe("candidatePoolStore — basic ops", () => {
  it("add / has / remove round-trip", () => {
    const c = makeCourse("0001");
    addCandidate(c);
    expect(isCandidate(c)).toBe(true);
    removeCandidate(c);
    expect(isCandidate(c)).toBe(false);
  });

  it("dedupes the same (year, semester, courseCode)", () => {
    addCandidate(makeCourse("0001"));
    addCandidate(makeCourse("0001"));
    expect(getCandidates()).toHaveLength(1);
  });

  it("treats different terms as distinct", () => {
    addCandidate(makeCourse("0001", 114, 1));
    addCandidate(makeCourse("0001", 114, 2));
    expect(getCandidates()).toHaveLength(2);
  });

  it("clearCandidates wipes everything", () => {
    addCandidate(makeCourse("0001"));
    addCandidate(makeCourse("0002"));
    clearCandidates();
    expect(getCandidates()).toEqual([]);
  });
});
