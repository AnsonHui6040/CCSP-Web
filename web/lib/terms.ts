/**
 * Academic term inference and helpers.
 *
 * Taiwan academic year 民國 = 西元 - 1911.
 * Semester 1: August – January (of next year)
 * Semester 2: February – July
 *
 * Example: 114 academic year = Aug 2025 – Jul 2026
 *   114-1: Aug 2025 – Jan 2026
 *   114-2: Feb 2026 – Jul 2026
 */

import type { Term } from "./types";

export type { Term } from "./types";

export function termLabel(t: Term): string {
  return `${t.year} 學年度第 ${t.semester} 學期`;
}

/** Returns the academic term that the given date falls in. */
export function inferCurrentAcademicTerm(now: Date): Term {
  const m = now.getMonth() + 1; // 1..12
  const y = now.getFullYear();

  if (m >= 8) {
    // Aug–Dec: semester 1 of academic year (西元年 - 1911)
    return { year: y - 1911, semester: 1 };
  }
  if (m === 1) {
    // January: still semester 1, but of the previous academic year
    return { year: y - 1912, semester: 1 };
  }
  // Feb–Jul: semester 2
  return { year: y - 1912, semester: 2 };
}

/** Convenience: infer the current term as of now. */
export function currentAcademicTerm(): Term {
  return inferCurrentAcademicTerm(new Date());
}

/** Returns true iff two terms represent the same year/semester. */
export function termEquals(a: Term, b: Term): boolean {
  return a.year === b.year && a.semester === b.semester;
}
