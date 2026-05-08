"use client";

import type { Conflict, CourseLike } from "@/lib/conflict";
import type { ScheduleMode, StoredScheduleCourse } from "@/lib/scheduleStore";
import { comparePeriod } from "@/lib/scheduleStats";

type Props = {
  conflicts: Conflict[];
  /** Reference map for matching CourseLike → persisted entry. */
  linkBack: WeakMap<CourseLike, StoredScheduleCourse>;
  mode: ScheduleMode;
};

const WEEKDAY_LABELS = ["", "一", "二", "三", "四", "五", "六", "日"];

export function ConflictList({ conflicts, linkBack, mode }: Props) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-text-dim)]">
        目前沒有衝堂。
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-xs">
      {conflicts.map((c, i) => {
        const a = linkBack.get(c.a);
        const b = linkBack.get(c.b);
        if (!a || !b) return null; // shouldn't happen
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
              <span className="break-words">{a.snapshot.courseName}</span>
              <span className="mx-1 text-[color:var(--color-text-dim)]">×</span>
              <span className="break-words">{b.snapshot.courseName}</span>
            </div>
            <div className="mt-1 text-[color:var(--color-text-dim)]">
              {summariseCells(c.overlaps)}
            </div>
            <div className="mt-0.5 text-[10px] text-[color:var(--color-text-dim)]">
              {a.courseCode} {classroomFor(a, c.overlaps[0])}
              {" · "}
              {b.courseCode} {classroomFor(b, c.overlaps[0])}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// helpers

function classroomFor(
  entry: StoredScheduleCourse,
  cell: { weekday: number; period: string },
): string {
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
