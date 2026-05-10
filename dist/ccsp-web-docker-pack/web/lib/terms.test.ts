import { describe, expect, it } from "vitest";
import { inferCurrentAcademicTerm, termEquals, termLabel } from "./terms";

describe("inferCurrentAcademicTerm", () => {
  it("2026-05-09 → 114-2", () => {
    expect(inferCurrentAcademicTerm(new Date("2026-05-09"))).toEqual({ year: 114, semester: 2 });
  });
  it("2025-09-01 → 114-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2025-09-01"))).toEqual({ year: 114, semester: 1 });
  });
  it("2026-01-15 → 114-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2026-01-15"))).toEqual({ year: 114, semester: 1 });
  });
  it("2026-02-15 → 114-2", () => {
    expect(inferCurrentAcademicTerm(new Date("2026-02-15"))).toEqual({ year: 114, semester: 2 });
  });
  it("2026-08-01 → 115-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2026-08-01"))).toEqual({ year: 115, semester: 1 });
  });
  it("2025-07-31 → 113-2", () => {
    expect(inferCurrentAcademicTerm(new Date("2025-07-31"))).toEqual({ year: 113, semester: 2 });
  });
  it("2025-08-01 → 114-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2025-08-01"))).toEqual({ year: 114, semester: 1 });
  });
  it("2024-12-31 → 113-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2024-12-31"))).toEqual({ year: 113, semester: 1 });
  });
  it("2025-01-01 → 113-1", () => {
    expect(inferCurrentAcademicTerm(new Date("2025-01-01"))).toEqual({ year: 113, semester: 1 });
  });
  it("2025-02-01 → 113-2", () => {
    expect(inferCurrentAcademicTerm(new Date("2025-02-01"))).toEqual({ year: 113, semester: 2 });
  });
});

describe("termLabel", () => {
  it("renders 114-1 label", () => {
    expect(termLabel({ year: 114, semester: 1 })).toBe("114 學年度第 1 學期");
  });
  it("renders 114-2 label", () => {
    expect(termLabel({ year: 114, semester: 2 })).toBe("114 學年度第 2 學期");
  });
});

describe("termEquals", () => {
  it("same term", () => {
    expect(termEquals({ year: 114, semester: 2 }, { year: 114, semester: 2 })).toBe(true);
  });
  it("different year", () => {
    expect(termEquals({ year: 114, semester: 1 }, { year: 115, semester: 1 })).toBe(false);
  });
  it("different semester", () => {
    expect(termEquals({ year: 114, semester: 1 }, { year: 114, semester: 2 })).toBe(false);
  });
});
