"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDetailFreshness } from "@/lib/detailFreshness";

type Props = {
  year: number;
  semester: number;
  courseCode: string;
  /** ISO-8601 string from course_details.fetched_at, or null if no detail row. */
  fetchedAt: string | null;
};

/**
 * Displays the current detail freshness state and a button to trigger a
 * manual refresh via POST /api/courses/[year]/[semester]/[courseCode]/refresh-detail.
 *
 * Never auto-fetches.  Only acts when the user explicitly presses the button.
 */
export function CourseDetailRefreshButton({
  year,
  semester,
  courseCode,
  fetchedAt,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "running">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const freshness = getDetailFreshness(fetchedAt);

  async function handleRefresh() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/courses/${year}/${semester}/${courseCode}/refresh-detail`,
        { method: "POST" },
      );
      const body = (await res.json()) as { status: string; message?: string };

      if (body.status === "success") {
        // Revalidate the Server Component so fresh data is shown
        router.refresh();
        setStatus("idle");
      } else if (body.status === "running") {
        setStatus("running");
      } else {
        setStatus("error");
        setErrorMsg(body.message ?? "更新失敗，請稍後再試。");
      }
    } catch {
      setStatus("error");
      setErrorMsg("更新失敗，請稍後再試。");
    }
  }

  // Derive button label
  let buttonLabel: string;
  if (status === "loading") {
    buttonLabel = "更新中…";
  } else if (!freshness.hasDetails) {
    buttonLabel = "取得詳細資料";
  } else if (freshness.isOlderThan3Days) {
    buttonLabel = "更新詳細資料";
  } else {
    buttonLabel = "重新更新詳細資料";
  }

  return (
    <div className="rounded border bg-[color:var(--color-surface)] p-3 text-xs space-y-2">
      {/* Freshness label */}
      <p
        className={
          freshness.isOlderThan3Days
            ? "text-[color:var(--color-warn)]"
            : "text-[color:var(--color-text-dim)]"
        }
      >
        {freshness.label}
      </p>

      {/* Running message */}
      {status === "running" && (
        <p className="text-[color:var(--color-warn)]">
          此課程詳細資料正在更新中，請稍後再試。
        </p>
      )}

      {/* Error message */}
      {status === "error" && errorMsg && (
        <p className="text-[color:var(--color-danger)]">{errorMsg}</p>
      )}

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={status === "loading"}
        className="w-full rounded border px-3 py-1.5 text-center transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
