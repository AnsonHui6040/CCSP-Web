"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { snapshotFromCourse } from "@/lib/courseSnapshot";
import { replaceScheduleFromShared } from "@/lib/scheduleStore";
import type { Course } from "@/lib/types";

type SharedCourseResult = {
  course: Course;
  status: "planned" | "confirmed";
};

type Props = {
  sharedCourses: SharedCourseResult[];
};

/**
 * Banner shown at the top of /schedule when a ?share= parameter is detected
 * and the server has resolved the course keys into full Course rows.
 *
 * The user must explicitly confirm the import — we never silently overwrite
 * localStorage.
 */
export function ShareImportBanner({ sharedCourses }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const count = sharedCourses.length;

  function handleDismiss() {
    // Remove the share param from the URL so the banner won't reappear on refresh.
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
    setDismissed(true);
  }

  function handleImport() {
    const entries = sharedCourses.map(({ course, status }) => ({
      courseCode: course.courseCode,
      year: course.year,
      semester: course.semester,
      status,
      snapshot: snapshotFromCourse(course),
    }));
    replaceScheduleFromShared(entries);

    // Clean up the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-surface)] px-4 py-3 text-sm"
    >
      <div>
        <p className="font-semibold">偵測到分享課表，包含 {count} 門課。</p>
        <p className="text-xs text-[color:var(--color-text-dim)]">
          匯入後會取代目前本機課表。
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          className="rounded bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium text-white transition hover:opacity-80"
        >
          匯入分享課表
        </button>
        <button
          onClick={handleDismiss}
          className="rounded border px-3 py-1 text-xs text-[color:var(--color-text-dim)] transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
        >
          忽略
        </button>
      </div>
    </div>
  );
}
