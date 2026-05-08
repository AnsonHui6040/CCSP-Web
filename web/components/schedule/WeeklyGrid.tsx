"use client";

import type { OccupiedSlot } from "@/lib/conflict";
import { PERIOD_ORDER } from "@/lib/scheduleStats";
import type {
  ScheduleMode,
  StoredScheduleCourse,
} from "@/lib/scheduleStore";
import { ScheduleCourseBlock } from "./ScheduleCourseBlock";

type Props = {
  courses: StoredScheduleCourse[];
  occupied: OccupiedSlot[];
  conflictKeys: ReadonlySet<string>;
  mode: ScheduleMode;
};

const WEEKDAYS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
];

/**
 * Indices in PERIOD_ORDER where a horizontal divider visually separates
 * morning (1-4), afternoon (5-8), evening (9-13), and special (A,B).
 * Spec §2 — same single grid, just visual separators.
 */
const DIVIDER_AFTER: ReadonlySet<string> = new Set(["4", "8", "13"]);

export function WeeklyGrid({ courses, occupied, conflictKeys, mode }: Props) {
  // Build a courseCode-keyed index of the persisted entries. Schedule is
  // single-term in practice, so courseCode alone disambiguates.
  const byCode = new Map<string, StoredScheduleCourse>();
  for (const c of courses) byCode.set(c.courseCode, c);

  // Build a lookup: cell-key → list of (entry, classroom) pairs from the
  // OccupiedSlot output so we don't recompute conflict math here.
  const cellMap = new Map<
    string,
    Array<{ entry: StoredScheduleCourse; classroom: string | null }>
  >();
  for (const slot of occupied) {
    const key = cellKey(slot.weekday, slot.period);
    const list: Array<{
      entry: StoredScheduleCourse;
      classroom: string | null;
    }> = [];
    for (const c of slot.courses) {
      const entry = byCode.get(c.courseCode);
      if (entry) {
        list.push({ entry, classroom: slot.classroomByCourse.get(c) ?? null });
      }
    }
    cellMap.set(key, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-[color:var(--color-surface)]">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-12" />
          {WEEKDAYS.map((d) => (
            <col key={d.value} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b">
            <th className="bg-[color:var(--color-surface-2)] p-1.5 text-[color:var(--color-text-dim)]">
              節
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d.value}
                className="bg-[color:var(--color-surface-2)] p-1.5 font-medium"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIOD_ORDER.map((period) => {
            const isDivider = DIVIDER_AFTER.has(period);
            return (
              <tr
                key={period}
                className={
                  isDivider
                    ? "border-b-2 border-[color:var(--color-border)]"
                    : "border-b border-[color:var(--color-border)]/60"
                }
              >
                <td className="bg-[color:var(--color-surface-2)] p-1 text-center align-top font-mono text-[color:var(--color-text-dim)]">
                  {period}
                </td>
                {WEEKDAYS.map((d) => {
                  const key = cellKey(d.value, period);
                  const occupants = cellMap.get(key) ?? [];
                  const hasConflict = conflictKeys.has(key);
                  return (
                    <td
                      key={d.value}
                      className={`align-top p-0.5 ${
                        hasConflict
                          ? mode === "official"
                            ? "bg-[color:var(--color-danger)]/5"
                            : "bg-[color:var(--color-warn)]/5"
                          : ""
                      }`}
                    >
                      {occupants.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {occupants.map(({ entry, classroom }) => (
                            <ScheduleCourseBlock
                              key={`${entry.year}-${entry.semester}-${entry.courseCode}`}
                              entry={entry}
                              classroom={classroom}
                              isConflicting={
                                hasConflict && occupants.length > 1
                              }
                              mode={mode}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function cellKey(weekday: number, period: string): string {
  return `${weekday}-${period}`;
}
