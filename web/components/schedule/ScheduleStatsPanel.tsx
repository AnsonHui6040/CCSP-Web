"use client";

import type { ScheduleStats } from "@/lib/scheduleStats";

type Props = {
  stats: ScheduleStats;
};

const WEEKDAY_LABEL = ["", "一", "二", "三", "四", "五", "六", "日"];

export function ScheduleStatsPanel({ stats }: Props) {
  if (stats.totalCourses === 0) {
    return (
      <p className="rounded border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-text-dim)]">
        加入課程後會顯示每日課量與空堂分析。
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          每日課量
        </div>
        <ul className="space-y-1">
          {stats.dailyLoad.map((d) => {
            const isLongest =
              stats.longestDay && stats.longestDay.weekday === d.weekday;
            return (
              <li
                key={d.weekday}
                className={`flex items-baseline justify-between gap-2 rounded border bg-[color:var(--color-surface-2)] px-2 py-1 ${
                  isLongest ? "border-[color:var(--color-accent)]/50" : ""
                }`}
              >
                <span className="font-medium">星期{WEEKDAY_LABEL[d.weekday]}</span>
                <span className="text-[color:var(--color-text-dim)]">
                  {d.courseCount} 門 · {d.periodCount} 節
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          空堂分析（首末節間的空白節次）
        </div>
        <ul className="space-y-1">
          {stats.freePeriods.map((d) => (
            <li
              key={d.weekday}
              className="flex items-baseline justify-between gap-2 rounded border bg-[color:var(--color-surface-2)] px-2 py-1"
            >
              <span className="font-medium">星期{WEEKDAY_LABEL[d.weekday]}</span>
              <span className="text-[color:var(--color-text-dim)]">
                {d.count === 0
                  ? "—"
                  : `${d.count} 節 (${d.freePeriodsBetweenFirstAndLast.join(",")})`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
