"use client";

import { TAG_DEFS_BY_KEY, sortTagKeys, type TagKey } from "@/lib/tags";
import { getCourseDisplayName } from "@/lib/courseDisplay";
import type { ScheduleDisplayBlock } from "@/lib/scheduleLayout";
import type { ScheduleMode } from "@/lib/scheduleStore";

type Props = {
  block: ScheduleDisplayBlock;
  mode: ScheduleMode;
};

/**
 * One merged-period course rectangle.
 *
 * Positioned via *absolute* inset within a grid-cell wrapper supplied by
 * `WeeklyGrid`. The wrapper handles `gridColumn` / `gridRow span`; this
 * component splits horizontally into N columns when `overlapCount > 1`
 * so two simultaneous courses sit side-by-side instead of stacking.
 */
export function ScheduleCourseBlock({ block, mode }: Props) {
  const { course, classroom, conflictLevel, periodSpan, overlapIndex, overlapCount } =
    block;
  const { snapshot, status } = course;
  const tagsAll = sortTagKeys(snapshot.tags);
  const visibleTags = tagsAll.slice(0, overlapCount > 2 ? 1 : 2);
  const overflow = tagsAll.length - visibleTags.length;
  const teachers = snapshot.teachers.map((t) => t.name).join("、");
  const displayName = getCourseDisplayName(snapshot.courseName);

  const isOfficial = mode === "official";
  const hasConflict = conflictLevel === "error" || conflictLevel === "warning";

  // Border + background colour
  const conflictClass =
    conflictLevel === "error"
      ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/15"
      : conflictLevel === "warning"
        ? "border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/15"
        : status === "confirmed"
          ? "border-[color:var(--color-accent)]/70 bg-[color:var(--color-accent)]/15"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]";

  // Official planned (unconfirmed) courses are slightly dimmed — no badge needed.
  const dimClass = isOfficial && status === "planned" && !hasConflict ? "opacity-60" : "";

  const tooltip = [
    snapshot.courseName,
    `${block.courseCode} · 星期${WEEKDAY_LABEL[block.weekday]} ${rangeLabel(block)}`,
    classroom ? `[${classroom}]` : "",
    teachers,
  ]
    .filter(Boolean)
    .join("\n");

  // When N>1, divide the cell horizontally. left / right inset is computed
  // from the column index so adjacent blocks have a 2px visual gap.
  const fraction = 100 / overlapCount;
  const inset = {
    top: 2,
    bottom: 2,
    left: `calc(${overlapIndex * fraction}% + 2px)`,
    right: `calc(${(overlapCount - overlapIndex - 1) * fraction}% + 2px)`,
  } as const;

  // Side-by-side blocks get tighter rendering: hide teachers + drop tag
  // count when there's not enough horizontal room.
  const isNarrow = overlapCount >= 2;
  const showTeachers = periodSpan >= 2 && Boolean(teachers);
  const showClassroom = Boolean(classroom);

  // Tags and status badges: planning mode only.
  const showTags = !isOfficial && periodSpan >= 2 && visibleTags.length > 0;
  const showConfirmedBadge = !isOfficial && status === "confirmed";
  // In official mode with conflict, show a compact "衝堂" label instead of tags.
  const showConflictLabel = isOfficial && conflictLevel === "error";

  return (
    <div
      style={{ position: "absolute", ...inset }}
      className={`flex min-w-0 flex-col gap-0.5 overflow-hidden rounded border p-1.5 text-[10.5px] leading-snug ${conflictClass} ${dimClass}`}
      title={tooltip}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={`break-words font-medium ${
            periodSpan >= 2 ? "line-clamp-3" : "line-clamp-2"
          }`}
        >
          {displayName}
        </span>
        {showConfirmedBadge && (
          <span className="shrink-0 rounded bg-[color:var(--color-accent)]/30 px-1 text-[9px] uppercase tracking-wider text-[color:var(--color-accent)]">
            ✓
          </span>
        )}
        {showConflictLabel && (
          <span className="shrink-0 rounded bg-[color:var(--color-danger)]/20 px-1 text-[9px] text-[color:var(--color-danger)]">
            衝堂
          </span>
        )}
      </div>

      {showTeachers && !isNarrow && (
        <div className="truncate text-[9.5px] text-[color:var(--color-text-dim)]">
          {teachers}
        </div>
      )}

      {showClassroom && (
        <div className="truncate font-mono text-[9px] text-[color:var(--color-text-dim)]">
          [{classroom}]
        </div>
      )}

      {showTags && (
        <div className="mt-auto flex flex-wrap gap-0.5">
          {visibleTags.map((k) => (
            <TagPill key={k} tagKey={k} />
          ))}
          {overflow > 0 && (
            <span className="rounded border border-[color:var(--color-border)] px-1 text-[9px] text-[color:var(--color-text-dim)]">
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers

const WEEKDAY_LABEL = ["", "一", "二", "三", "四", "五", "六", "日"];

function rangeLabel(block: ScheduleDisplayBlock): string {
  return block.startPeriod === block.endPeriod
    ? `第 ${block.startPeriod} 節`
    : `第 ${block.startPeriod}-${block.endPeriod} 節`;
}

function TagPill({ tagKey }: { tagKey: TagKey }) {
  const def = TAG_DEFS_BY_KEY[tagKey];
  if (!def) return null;
  return (
    <span
      title={def.display}
      className="rounded border border-[color:var(--color-border)] px-1 text-[9px]"
    >
      {def.display}
    </span>
  );
}
