"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";
import { useCandidatePool } from "./candidatePoolStore";
import {
  addCourseToSchedule,
  isCourseInSchedule,
} from "@/lib/scheduleStore";

type Props = {
  course: Course;
};

/**
 * Sidebar action panel on the course detail page.
 * Wraps both candidate-pool and schedule mutations in one place so users
 * don't have to bounce back to /courses to make a decision.
 */
export function CourseDetailActions({ course }: Props) {
  const { has: hasCandidate, toggle, hydrated } = useCandidatePool();
  const [scheduleHas, setScheduleHas] = useState(false);
  useEffect(() => {
    if (hydrated) setScheduleHas(isCourseInSchedule(course));
  }, [hydrated, course]);

  if (!hydrated) {
    return (
      <div className="rounded border bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-text-dim)]">
        載入中…
      </div>
    );
  }

  const inCandidate = hasCandidate(course);

  return (
    <div className="space-y-2 rounded-lg border bg-[color:var(--color-surface)] p-3">
      <button
        onClick={() => toggle(course)}
        className={`w-full rounded border px-3 py-2 text-sm font-medium transition ${
          inCandidate
            ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
            : "hover:border-[color:var(--color-accent)]"
        }`}
      >
        {inCandidate ? "✓ 已在候選池" : "+ 加入候選池"}
      </button>

      <button
        onClick={() => {
          addCourseToSchedule(course);
          setScheduleHas(true);
        }}
        disabled={scheduleHas}
        className={`w-full rounded border px-3 py-2 text-sm font-medium transition ${
          scheduleHas
            ? "border-[color:var(--color-border)] text-[color:var(--color-text-dim)]"
            : "border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
        }`}
      >
        {scheduleHas ? "✓ 已加入課表" : "📅 加入課表"}
      </button>

      <Link
        href="/schedule"
        className="block rounded border px-3 py-2 text-center text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)]"
      >
        前往我的課表 →
      </Link>
    </div>
  );
}
