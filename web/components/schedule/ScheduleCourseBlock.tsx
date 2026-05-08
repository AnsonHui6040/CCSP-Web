"use client";

import { TAG_DEFS_BY_KEY, sortTagKeys, type TagKey } from "@/lib/tags";
import type { StoredScheduleCourse } from "@/lib/scheduleStore";

type Props = {
  entry: StoredScheduleCourse;
  classroom: string | null;
  isConflicting: boolean;
  mode: "planning" | "official";
};

/**
 * Renders a single course inside one cell of the weekly grid.
 * Multi-period courses are rendered once per occupied cell (no row-span
 * yet — see ScheduleSpec section 7 / 11).
 */
export function ScheduleCourseBlock({
  entry,
  classroom,
  isConflicting,
  mode,
}: Props) {
  const { snapshot, status } = entry;
  const tags = sortTagKeys(snapshot.tags).slice(0, 2);
  const overflow = snapshot.tags.length - tags.length;

  const teachers = snapshot.teachers.map((t) => t.name).join("、");
  const conflictClass = isConflicting
    ? mode === "official"
      ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10"
      : "border-[color:var(--color-warn)] bg-[color:var(--color-warn)]/10"
    : status === "confirmed"
      ? "border-[color:var(--color-accent)]/70 bg-[color:var(--color-accent)]/15"
      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]";

  return (
    <div
      className={`min-w-0 overflow-hidden rounded border p-1.5 text-[10.5px] leading-snug ${conflictClass} ${
        status === "planned" ? "opacity-90" : ""
      }`}
      title={`${snapshot.courseName} (${entry.courseCode})\n${teachers}\n${classroom ?? ""}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="line-clamp-2 break-words font-medium">
          {snapshot.courseName}
        </span>
        {status === "confirmed" && (
          <span className="shrink-0 rounded bg-[color:var(--color-accent)]/30 px-1 text-[9px] uppercase tracking-wider text-[color:var(--color-accent)]">
            已確認
          </span>
        )}
      </div>
      <div className="font-mono text-[9.5px] text-[color:var(--color-text-dim)]">
        {entry.courseCode}
        {classroom ? ` · ${classroom}` : ""}
      </div>
      {teachers && (
        <div className="truncate text-[9.5px] text-[color:var(--color-text-dim)]">
          {teachers}
        </div>
      )}
      {tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {tags.map((k) => (
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
