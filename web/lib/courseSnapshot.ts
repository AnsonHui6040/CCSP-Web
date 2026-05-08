/**
 * Build / match the lightweight `StoredCourseSnapshot` we persist to
 * localStorage from the full server-side `Course` row.
 *
 * Snapshots make the schedule page self-sufficient: the client never has
 * to round-trip to SQLite for a course it already added. The trade-off is
 * staleness — but capacity/remaining are excluded for that exact reason,
 * and the rest (name, time, tags) almost never changes mid-semester.
 */

import type { Course, StoredCourseSnapshot } from "./types";

/** A primary-key triple identifying a course unambiguously across terms. */
export type SnapshotKey = {
  courseCode: string;
  year: number;
  semester: number;
};

export function snapshotFromCourse(c: Course): StoredCourseSnapshot {
  return {
    courseCode: c.courseCode,
    year: c.year,
    semester: c.semester,
    courseName: c.courseName,
    courseNameEn: c.courseNameEn,
    teachers: c.teachers,
    credits: c.creditsTotal,
    timeSlots: c.timeSlots,
    rawNote: c.rawNote,
    tags: c.tags,
    warnings: c.warnings,
    rules: c.rules,
    riskLevel: c.riskLevel,
    deptName: c.deptName,
    requiredOrElective: c.requiredOrElective,
  };
}

export function keyMatches(a: SnapshotKey, b: SnapshotKey): boolean {
  return (
    a.courseCode === b.courseCode &&
    a.year === b.year &&
    a.semester === b.semester
  );
}

export function snapshotKey(s: SnapshotKey): string {
  return `${s.year}-${s.semester}-${s.courseCode}`;
}
