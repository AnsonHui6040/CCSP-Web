"use client";

import { Fragment } from "react";
import { OFFICIAL_PERIODS, periodToGridRow, type OfficialPeriod } from "@/lib/periods";
import { getCourseDisplayName } from "@/lib/courseDisplay";
import { TAG_DEFS_BY_KEY, sortTagKeys, type TagKey } from "@/lib/tags";
import type { ScheduleDisplayBlock } from "@/lib/scheduleLayout";
import type { ScheduleMode, StoredScheduleCourse } from "@/lib/scheduleStore";
import { ScheduleCourseBlock } from "./ScheduleCourseBlock";

type Props = {
  blocks: ScheduleDisplayBlock[];
  conflictKeys: ReadonlySet<string>; // "weekday-period" — drives cell tint
  mode: ScheduleMode;
  /** Courses with no time slots — shown in the 未排定時間 column. */
  noTimeCourses: StoredScheduleCourse[];
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

/** Periods after which we draw a thicker bottom divider. */
const DIVIDER_AFTER: ReadonlySet<string> = new Set(["8", "13"]);

/**
 * Official 9-column weekly schedule grid:
 *   col 1  = period label (key + time)
 *   col 2–8 = 星期一–日
 *   col 9  = 未排定時間
 *
 * Rows follow the official timetable (0, 1 … 4, 4.5[break], 5 … 13)
 * plus optional A/B rows when those periods appear in the schedule.
 *
 * Block placement uses `periodToGridRow` so the 4.5 break row is
 * correctly accounted for — a block spanning periods 4–5 will visually
 * cover period 4, the break row, and period 5.
 */
export function WeeklyGrid({ blocks, conflictKeys, mode, noTimeCourses }: Props) {
  // Determine if any block uses A or B periods.
  const hasAB = blocks.some((b) => b.periods.some((p) => p === "A" || p === "B"));

  // Build the full set of display rows.
  type ABRow = { key: "A" | "B"; label: string; time: string; isBreak: boolean };
  const displayRows: (OfficialPeriod | ABRow)[] = hasAB
    ? [
        ...OFFICIAL_PERIODS,
        { key: "A", label: "A", time: "", isBreak: false },
        { key: "B", label: "B", time: "", isBreak: false },
      ]
    : [...OFFICIAL_PERIODS];

  // CSS grid sizing.
  const gridTemplateColumns =
    "5.5rem repeat(7, minmax(0, 1fr)) minmax(9rem, 13rem)";
  const gridTemplateRows = [
    "auto",
    ...displayRows.map((r) =>
      r.isBreak ? "1.25rem" : "minmax(3.25rem, auto)",
    ),
  ].join(" ");

  return (
    <div className="overflow-x-auto rounded-lg border bg-[color:var(--color-surface)]">
      <div
        className="grid min-w-[820px]"
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {/* ── Header row ────────────────────────────────────────────── */}
        <HeaderCell row={1} col={1}>
          節＼星期
        </HeaderCell>
        {WEEKDAYS.map((d, i) => (
          <HeaderCell key={d.value} row={1} col={i + 2}>
            {d.label}
          </HeaderCell>
        ))}
        <HeaderCell row={1} col={9}>
          未排定時間
        </HeaderCell>

        {/* ── Period skeleton rows ──────────────────────────────────── */}
        {displayRows.map((period, pi) => {
          const row = pi + 2;
          const isDivider = DIVIDER_AFTER.has(period.key);
          return (
            <Fragment key={period.key}>
              <PeriodLabel
                row={row}
                col={1}
                divider={isDivider}
                isBreak={period.isBreak}
                time={period.time}
              >
                {period.label}
              </PeriodLabel>
              {WEEKDAYS.map((d, di) => {
                const cellId = `${d.value}-${period.key}`;
                const inConflict = conflictKeys.has(cellId);
                return (
                  <SkeletonCell
                    key={d.value}
                    row={row}
                    col={di + 2}
                    divider={isDivider}
                    isBreak={period.isBreak}
                    conflictTint={
                      inConflict
                        ? mode === "official"
                          ? "danger"
                          : "warn"
                        : null
                    }
                  />
                );
              })}
            </Fragment>
          );
        })}

        {/* ── 未排定時間 merged column content ─────────────────────── */}
        <NoTimeColumn
          rowStart={2}
          rowSpan={displayRows.length}
          courses={noTimeCourses}
        />

        {/* ── Course blocks ─────────────────────────────────────────── */}
        {blocks.map((b) => {
          const startRow = periodToGridRow(b.startPeriod, hasAB);
          const endRow = periodToGridRow(b.endPeriod, hasAB);
          if (startRow < 0 || endRow < 0) return null;
          const rowSpan = endRow - startRow + 1;
          return (
            <div
              key={b.blockKey}
              style={{
                gridColumn: b.weekday + 1,
                gridRow: `${startRow} / span ${rowSpan}`,
                position: "relative",
                zIndex: 10,
              }}
            >
              <ScheduleCourseBlock block={b} mode={mode} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 未排定時間 column

function NoTimeColumn({
  rowStart,
  rowSpan,
  courses,
}: {
  rowStart: number;
  rowSpan: number;
  courses: StoredScheduleCourse[];
}) {
  return (
    <div
      style={{
        gridColumn: 9,
        gridRow: `${rowStart} / span ${rowSpan}`,
      }}
      className="overflow-y-auto border-b border-[color:var(--color-border)]/40 p-1"
    >
      {courses.length === 0 ? (
        <span className="block pt-2 text-center text-[10px] text-[color:var(--color-text-dim)] opacity-40">
          —
        </span>
      ) : (
        <ul className="space-y-1">
          {courses.map((c) => (
            <NoTimeCourseCard
              key={`${c.courseCode}-${c.year}-${c.semester}`}
              course={c}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoTimeCourseCard({ course }: { course: StoredScheduleCourse }) {
  const { snapshot, status } = course;
  const displayName = getCourseDisplayName(snapshot.courseName);
  const teachers = snapshot.teachers.map((t) => t.name).join("、");
  const tagsAll = sortTagKeys(snapshot.tags);
  const visibleTags = tagsAll.slice(0, 2);

  return (
    <li
      title={snapshot.courseName}
      className={`flex min-w-0 flex-col gap-0.5 overflow-hidden rounded border p-1 text-[10px] leading-snug ${
        status === "confirmed"
          ? "border-[color:var(--color-accent)]/70 bg-[color:var(--color-accent)]/10"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
      }`}
    >
      <span className="line-clamp-2 font-medium">{displayName}</span>
      {teachers && (
        <span className="truncate text-[9px] text-[color:var(--color-text-dim)]">
          {teachers}
        </span>
      )}
      {snapshot.credits != null && (
        <span className="text-[9px] text-[color:var(--color-text-dim)]">
          {snapshot.credits} 學分
        </span>
      )}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {visibleTags.map((k) => (
            <NoTimeTagPill key={k} tagKey={k} />
          ))}
        </div>
      )}
    </li>
  );
}

function NoTimeTagPill({ tagKey }: { tagKey: TagKey }) {
  const def = TAG_DEFS_BY_KEY[tagKey];
  if (!def) return null;
  return (
    <span className="rounded border border-[color:var(--color-border)] px-0.5 text-[8px]">
      {def.display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton cells

function HeaderCell({
  row,
  col,
  children,
}: {
  row: number;
  col: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ gridRow: row, gridColumn: col }}
      className="border-b border-r border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1.5 text-center text-[10.5px] font-medium"
    >
      {children}
    </div>
  );
}

function PeriodLabel({
  row,
  col,
  divider,
  isBreak,
  time,
  children,
}: {
  row: number;
  col: number;
  divider: boolean;
  isBreak: boolean;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ gridRow: row, gridColumn: col }}
      className={`flex flex-col items-center justify-center gap-0 border-r px-0.5 font-mono border-r-[color:var(--color-border)] ${
        isBreak
          ? "border-b border-b-[color:var(--color-border)] bg-[color:var(--color-surface-3,#0d0d14)] opacity-60"
          : divider
            ? "border-b-2 border-b-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
            : "border-b border-b-[color:var(--color-border)]/60 bg-[color:var(--color-surface-2)]"
      }`}
    >
      <span className="text-[11px] leading-none text-[color:var(--color-text-dim)]">
        {children}
      </span>
      {time && (
        <span className="whitespace-nowrap text-center text-[8px] leading-tight text-[color:var(--color-text-dim)] opacity-70">
          {time}
        </span>
      )}
    </div>
  );
}

function SkeletonCell({
  row,
  col,
  divider,
  isBreak,
  conflictTint,
}: {
  row: number;
  col: number;
  divider: boolean;
  isBreak: boolean;
  conflictTint: "warn" | "danger" | null;
}) {
  const tintClass =
    conflictTint === "danger"
      ? "bg-[color:var(--color-danger)]/5"
      : conflictTint === "warn"
        ? "bg-[color:var(--color-warn)]/5"
        : "";
  return (
    <div
      style={{ gridRow: row, gridColumn: col }}
      className={`border-r border-[color:var(--color-border)]/40 ${
        isBreak
          ? "border-b border-b-[color:var(--color-border)] bg-[color:var(--color-surface-3,#0d0d14)] opacity-50"
          : divider
            ? "border-b-2 border-b-[color:var(--color-border)]"
            : "border-b border-b-[color:var(--color-border)]/40"
      } ${tintClass}`}
    />
  );
}
