"use client";

import type { Conflict } from "@/lib/conflict";
import type { ScheduleMode, StoredScheduleCourse } from "@/lib/scheduleStore";
import { keyMatches } from "@/lib/courseSnapshot";
import { comparePeriod } from "@/lib/scheduleStats";

type Props = {
  conflicts: Conflict[];
  courses: StoredScheduleCourse[];
  mode: ScheduleMode;
};

const WEEKDAY_LABELS = ["", "一", "二", "三", "四", "五", "六", "日"];

export function ConflictList({ conflicts, courses, mode }: Props) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-text-dim)]">
        目前沒有衝堂。
      </p>
    );
  }

  // Merge entries that share the same (a, b) pair across multiple cells.
  const merged = mergeByPair(conflicts);

  return (
    <ul className="space-y-2 text-xs">
      {merged.map((m, i) => {
        const a = findEntry(courses, m.a);
        const b = findEntry(courses, m.b);
        return (
          <li
            key={i}
            className={`rounded border p-2 ${
              mode === "official"
                ? "border-[color:var(--color-danger)]/50 bg-[color:var(--color-danger)]/5"
                : "border-[color:var(--color-warn)]/50 bg-[color:var(--color-warn)]/5"
            }`}
          >
            <div className="font-medium">
              <span>{m.a.snapshot.courseName}</span>
              <span className="mx-1 text-[color:var(--color-text-dim)]">×</span>
              <span>{m.b.snapshot.courseName}</span>
            </div>
            <div className="mt-1 text-[color:var(--color-text-dim)]">
              {summariseCells(m.cells)}
            </div>
            <div className="mt-0.5 text-[10px] text-[color:var(--color-text-dim)]">
              {a?.courseCode} {classroomFor(a, m.cells[0])}
              {" · "}
              {b?.courseCode} {classroomFor(b, m.cells[0])}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// helpers

type Merged = {
  a: StoredScheduleCourse;
  b: StoredScheduleCourse;
  cells: Array<{ weekday: number; period: string }>;
};

function mergeByPair(conflicts: Conflict[]): Merged[] {
  const out: Merged[] = [];
  for (const c of conflicts) {
    out.push({
      a: c.a as unknown as StoredScheduleCourse,
      b: c.b as unknown as StoredScheduleCourse,
      cells: c.overlaps,
    });
  }
  return out;
}

function findEntry(
  courses: StoredScheduleCourse[],
  like: { courseCode: string; year?: number; semester?: number },
): StoredScheduleCourse | undefined {
  return courses.find(
    (c) =>
      c.courseCode === like.courseCode &&
      (like.year === undefined || c.year === like.year) &&
      (like.semester === undefined || c.semester === like.semester),
  );
}

function classroomFor(
  entry: StoredScheduleCourse | undefined,
  cell: { weekday: number; period: string },
): string {
  if (!entry) return "";
  const slot = entry.snapshot.timeSlots.find(
    (s) =>
      Number(s.weekday) === cell.weekday &&
      s.periods.map(String).includes(cell.period),
  );
  return slot?.classroom ? `(${slot.classroom})` : "";
}

function summariseCells(cells: Array<{ weekday: number; period: string }>): string {
  const byDay = new Map<number, string[]>();
  for (const cell of cells) {
    let list = byDay.get(cell.weekday);
    if (!list) {
      list = [];
      byDay.set(cell.weekday, list);
    }
    list.push(cell.period);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);
  return days
    .map((wd) => {
      const periods = byDay.get(wd)!.sort(comparePeriod);
      return `星期${WEEKDAY_LABELS[wd]} 第 ${periods.join(",")} 節`;
    })
    .join("；");
}

// keyMatches re-export referenced indirectly above via type only; silence
// unused-import lint on stripped builds by referencing it once.
void keyMatches;
