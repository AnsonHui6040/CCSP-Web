/** Pure presentation helpers. No DB access; safe to import in client code. */

import type { Course, TimeSlot } from "./types";

const WEEKDAY_NAMES = ["", "一", "二", "三", "四", "五", "六", "日"];

export function formatWeekday(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? String(weekday);
}

export function formatTimeSlots(slots: TimeSlot[]): string {
  if (slots.length === 0) return "未排定時間";
  return slots
    .map((s) => {
      const wd = `星期${formatWeekday(s.weekday)}`;
      const periods = s.periods.join(",");
      const room = s.classroom ? `[${s.classroom}]` : "";
      return `${wd}/${periods}${room}`;
    })
    .join("  ");
}

export function formatTeachers(course: Course): string {
  return course.teachers.map((t) => t.name).join("、") || "未定";
}

export function formatCredits(course: Course): string {
  if (course.creditsRaw) return course.creditsRaw;
  if (course.creditsTotal !== null) return String(course.creditsTotal);
  return "—";
}

export type RemainingTier = "ok" | "warn" | "danger" | "unknown";

export function remainingTier(course: Course): RemainingTier {
  const r = course.remaining;
  if (r === null) return "unknown";
  if (r >= 20) return "ok";
  if (r >= 5) return "warn";
  return "danger";
}

export function termKey(year: number, semester: number): string {
  return `${year}-${semester}`;
}

export function candidateKey(
  year: number,
  semester: number,
  courseCode: string,
): string {
  return `${year}-${semester}-${courseCode}`;
}
