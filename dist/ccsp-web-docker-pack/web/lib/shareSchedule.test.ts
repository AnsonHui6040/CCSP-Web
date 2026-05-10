import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  decodeSharedSchedule,
  encodeSharedSchedule,
  normalizeSharedSchedule,
} from "./shareSchedule";
import type { ScheduleState } from "./scheduleStore";

// ---------------------------------------------------------------------------
// Helpers

function makeState(
  courses: Array<{
    y: number;
    s: number;
    c: string;
    st: "planned" | "confirmed";
  }>,
): ScheduleState {
  return {
    version: 1,
    mode: "planning",
    courses: courses.map(({ y, s, c, st }) => ({
      courseCode: c,
      year: y,
      semester: s,
      status: st,
      addedAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      snapshot: {
        courseCode: c,
        year: y,
        semester: s,
        courseName: `Course ${c}`,
        courseNameEn: null,
        teachers: [],
        credits: 3,
        timeSlots: [],
        rawNote: null,
        tags: [],
        warnings: [],
        rules: [],
        riskLevel: "low",
        deptName: null,
        requiredOrElective: null,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// encode / decode round-trips

describe("encodeSharedSchedule + decodeSharedSchedule", () => {
  it("1. 空課表可以 encode / decode", () => {
    const state = makeState([]);
    const encoded = encodeSharedSchedule(state);
    const decoded = decodeSharedSchedule(encoded);
    expect(decoded).toEqual({ v: 1, courses: [] });
  });

  it("2. 一門課可以 encode / decode", () => {
    const state = makeState([{ y: 114, s: 1, c: "0001", st: "planned" }]);
    const encoded = encodeSharedSchedule(state);
    const decoded = decodeSharedSchedule(encoded);
    expect(decoded).toEqual({
      v: 1,
      courses: [{ y: 114, s: 1, c: "0001", st: "planned" }],
    });
  });

  it("3. 多門課可以 encode / decode", () => {
    const state = makeState([
      { y: 114, s: 1, c: "0001", st: "planned" },
      { y: 114, s: 1, c: "0006", st: "planned" },
      { y: 114, s: 2, c: "0999", st: "confirmed" },
    ]);
    const decoded = decodeSharedSchedule(encodeSharedSchedule(state));
    expect(decoded?.courses).toHaveLength(3);
    expect(decoded?.courses[1]).toEqual({ y: 114, s: 1, c: "0006", st: "planned" });
    expect(decoded?.courses[2].st).toBe("confirmed");
  });

  it("4. planned / confirmed 狀態保留", () => {
    const state = makeState([
      { y: 114, s: 1, c: "0001", st: "planned" },
      { y: 114, s: 1, c: "0002", st: "confirmed" },
    ]);
    const decoded = decodeSharedSchedule(encodeSharedSchedule(state));
    expect(decoded?.courses[0].st).toBe("planned");
    expect(decoded?.courses[1].st).toBe("confirmed");
  });
});

// ---------------------------------------------------------------------------
// Error cases

describe("decodeSharedSchedule — error cases", () => {
  it("5. malformed base64 回傳 null", () => {
    expect(decodeSharedSchedule("!!!not-base64!!!")).toBeNull();
  });

  it("6. malformed JSON 回傳 null", () => {
    // valid base64 but not JSON
    const encoded = btoa("not-json").replace(/=/g, "");
    expect(decodeSharedSchedule(encoded)).toBeNull();
  });

  it("7. 缺少 v 回傳 null", () => {
    const encoded = btoa(JSON.stringify({ courses: [] })).replace(/=/g, "");
    expect(decodeSharedSchedule(encoded)).toBeNull();
  });

  it("8. v 不等於 1 回傳 null", () => {
    const encoded = btoa(JSON.stringify({ v: 2, courses: [] })).replace(/=/g, "");
    expect(decodeSharedSchedule(encoded)).toBeNull();
  });

  it("9. 缺少 courses 回傳 null", () => {
    const encoded = btoa(JSON.stringify({ v: 1 })).replace(/=/g, "");
    expect(decodeSharedSchedule(encoded)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeSharedSchedule — item-level validation

describe("normalizeSharedSchedule — item validation", () => {
  it("10. course item 缺 y 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ s: 1, c: "0001", st: "planned" }] }),
    ).toBeNull();
  });

  it("11. courseCode 不是 string 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, s: 1, c: 1, st: "planned" }] }),
    ).toBeNull();
  });

  it("12. year 不是 number 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: "114", s: 1, c: "0001", st: "planned" }] }),
    ).toBeNull();
  });

  it("13. status 非 planned / confirmed 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, s: 1, c: "0001", st: "draft" }] }),
    ).toBeNull();
  });

  it("10b. course item 缺 s 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, c: "0001", st: "planned" }] }),
    ).toBeNull();
  });

  it("10c. course item 缺 c 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, s: 1, st: "planned" }] }),
    ).toBeNull();
  });

  it("10d. course item 缺 st 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, s: 1, c: "0001" }] }),
    ).toBeNull();
  });

  it("12b. semester 不是 number 回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: [{ y: 114, s: "1", c: "0001", st: "planned" }] }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildShareUrl

describe("buildShareUrl", () => {
  it("14. 包含 /schedule?share=", () => {
    const state = makeState([{ y: 114, s: 1, c: "0001", st: "planned" }]);
    const url = buildShareUrl(state, "https://example.com");
    expect(url).toMatch(/^https:\/\/example\.com\/schedule\?share=.+/);
  });

  it("15. encode 結果不含 + / / / =（符合 base64url）", () => {
    const state = makeState([
      { y: 114, s: 1, c: "0001", st: "planned" },
      { y: 114, s: 1, c: "0006", st: "confirmed" },
    ]);
    const encoded = encodeSharedSchedule(state);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});

// ---------------------------------------------------------------------------
// Extra: ensure deterministic

describe("determinism", () => {
  it("同一課表兩次 encode 結果相同", () => {
    const state = makeState([{ y: 114, s: 1, c: "0001", st: "planned" }]);
    expect(encodeSharedSchedule(state)).toBe(encodeSharedSchedule(state));
  });
});

// ---------------------------------------------------------------------------
// courses length limit

describe("normalizeSharedSchedule — courses length limit", () => {
  function makeCourses(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      y: 114,
      s: 1,
      c: String(i + 1).padStart(4, "0"),
      st: "planned" as const,
    }));
  }

  it("100 門課 OK", () => {
    const result = normalizeSharedSchedule({ v: 1, courses: makeCourses(100) });
    expect(result).not.toBeNull();
    expect(result?.courses).toHaveLength(100);
  });

  it("101 門課回傳 null", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: makeCourses(101) }),
    ).toBeNull();
  });

  it("超大 payload（1000 門）回傳 null 且不 crash", () => {
    expect(
      normalizeSharedSchedule({ v: 1, courses: makeCourses(1000) }),
    ).toBeNull();
  });

  it("encodeSharedSchedule + decodeSharedSchedule round-trip 100 門", () => {
    const state = makeState(makeCourses(100));
    const decoded = decodeSharedSchedule(encodeSharedSchedule(state));
    expect(decoded).not.toBeNull();
    expect(decoded?.courses).toHaveLength(100);
  });
});
