"use client";

import { Fragment } from "react";
import { PERIOD_ORDER } from "@/lib/scheduleStats";
import type { ScheduleDisplayBlock } from "@/lib/scheduleLayout";
import type { ScheduleMode } from "@/lib/scheduleStore";
import { ScheduleCourseBlock } from "./ScheduleCourseBlock";

type Props = {
  blocks: ScheduleDisplayBlock[];
  conflictKeys: ReadonlySet<string>; // "weekday-period" — drives cell tint
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

/** Periods after which we draw a thicker divider (morning/afternoon/evening/special). */
const DIVIDER_PERIODS: ReadonlySet<string> = new Set(["4", "8", "13"]);

/**
 * 7×15 weekly grid using CSS Grid so that multi-period courses can be
 * rendered as a single row-spanning rectangle (replaces the V1 "draw
 * the same block in every cell" approach).
 *
 * Layout:
 *   col 1            row 1            "節"      header corner
 *   col 1            row 2..16        period number labels
 *   col 2..8         row 1            day labels
 *   col 2..8         row 2..16        skeleton cells (borders + conflict tint)
 *   ↑ blocks placed via gridColumn / gridRow span
 */
export function WeeklyGrid({ blocks, conflictKeys, mode }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-[color:var(--color-surface)]">
      <div
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `auto repeat(${PERIOD_ORDER.length}, minmax(3.25rem, auto))`,
        }}
      >
        {/* Header row */}
        <HeaderCell row={1} col={1}>
          節
        </HeaderCell>
        {WEEKDAYS.map((d, i) => (
          <HeaderCell key={d.value} row={1} col={i + 2}>
            {d.label}
          </HeaderCell>
        ))}

        {/* Period skeleton */}
        {PERIOD_ORDER.map((period, pi) => {
          const row = pi + 2;
          const isDivider = DIVIDER_PERIODS.has(period);
          return (
            <Fragment key={period}>
              <PeriodLabel row={row} col={1} divider={isDivider}>
                {period}
              </PeriodLabel>
              {WEEKDAYS.map((d, di) => {
                const cellId = `${d.value}-${period}`;
                const inConflict = conflictKeys.has(cellId);
                return (
                  <SkeletonCell
                    key={d.value}
                    row={row}
                    col={di + 2}
                    divider={isDivider}
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

        {/* Course blocks: each grid-cell wrapper handles row-span placement;
            the inner block uses absolute positioning to support side-by-
            side rendering when `overlapCount > 1`. */}
        {blocks.map((b) => {
          const startIdx = PERIOD_ORDER.indexOf(
            b.startPeriod as (typeof PERIOD_ORDER)[number],
          );
          if (startIdx < 0) return null;
          return (
            <div
              key={b.blockKey}
              style={{
                gridColumn: b.weekday + 1,
                gridRow: `${startIdx + 2} / span ${b.periodSpan}`,
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
      className="border-b border-r border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1.5 text-center text-xs font-medium"
    >
      {children}
    </div>
  );
}

function PeriodLabel({
  row,
  col,
  divider,
  children,
}: {
  row: number;
  col: number;
  divider: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ gridRow: row, gridColumn: col }}
      className={`border-r bg-[color:var(--color-surface-2)] p-1 text-center font-mono text-[11px] text-[color:var(--color-text-dim)] ${
        divider
          ? "border-b-2 border-b-[color:var(--color-border)]"
          : "border-b border-b-[color:var(--color-border)]/60"
      }`}
    >
      {children}
    </div>
  );
}

function SkeletonCell({
  row,
  col,
  divider,
  conflictTint,
}: {
  row: number;
  col: number;
  divider: boolean;
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
        divider
          ? "border-b-2 border-b-[color:var(--color-border)]"
          : "border-b border-b-[color:var(--color-border)]/40"
      } ${tintClass}`}
    />
  );
}
