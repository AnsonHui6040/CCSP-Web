"use client";

import Link from "next/link";
import { TAG_DEFS_BY_KEY, sortTagKeys } from "@/lib/tags";
import type { StoredScheduleCourse } from "@/lib/scheduleStore";
import { courseDetailHref } from "@/lib/courseLinks";

type Props = {
  courses: StoredScheduleCourse[];
};

/**
 * Render no-time courses that can't fit into the weekly grid (論文 / 實習 /
 * 上課時間另訂). They still count toward credits and can be confirmed.
 */
export function NoTimeCourseList({ courses }: Props) {
  if (courses.length === 0) {
    return (
      <p className="rounded border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-text-dim)]">
        沒有無時間的課程。
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {courses.map((entry) => {
        const tags = sortTagKeys(entry.snapshot.tags).slice(0, 3);
        return (
          <li
            key={`${entry.year}-${entry.semester}-${entry.courseCode}`}
            className="rounded border bg-[color:var(--color-surface-2)] p-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">
                {entry.snapshot.courseName}
              </span>
              {entry.status === "confirmed" && (
                <span className="shrink-0 rounded bg-[color:var(--color-accent)]/30 px-1 text-[9px] uppercase tracking-wider text-[color:var(--color-accent)]">
                  已確認
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] text-[color:var(--color-text-dim)]">
              {entry.courseCode}
              {entry.snapshot.credits !== null
                ? ` · ${entry.snapshot.credits} 學分`
                : ""}
            </div>
            {tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {tags.map((k) => {
                  const def = TAG_DEFS_BY_KEY[k];
                  if (!def) return null;
                  return (
                    <span
                      key={k}
                      className="rounded border border-[color:var(--color-border)] px-1 text-[9px]"
                    >
                      {def.display}
                    </span>
                  );
                })}
              </div>
            )}
            {entry.snapshot.rawNote && (
              <p className="mt-1 line-clamp-2 text-[10px] text-[color:var(--color-text-dim)]">
                {entry.snapshot.rawNote}
              </p>
            )}
            <div className="mt-1.5">
              <Link
                href={courseDetailHref(entry)}
                className="text-[10px] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] hover:underline"
              >
                詳細資料
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
