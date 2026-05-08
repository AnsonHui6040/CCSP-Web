"use client";

import Link from "next/link";
import { useState } from "react";
import { useCandidatePool } from "./candidatePoolStore";

/**
 * Floating quick-glance panel on /courses. The richer UI (with "add to
 * schedule" buttons) lives on /schedule. We keep this lightweight to
 * avoid duplicating the schedule sidebar.
 */
export function CandidatePoolPanel() {
  const { entries, remove, clear, hydrated } = useCandidatePool();
  const [open, setOpen] = useState(true);

  if (!hydrated) return null;

  return (
    <aside
      className={`fixed bottom-4 right-4 z-30 w-80 rounded-lg border bg-[color:var(--color-surface)] shadow-lg transition ${
        open ? "" : "translate-y-[calc(100%-44px)]"
      }`}
      aria-label="候選課程池"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-t-lg px-3 py-2.5 text-left text-sm font-semibold"
      >
        <span>候選課程池 ({entries.length})</span>
        <span className="text-[color:var(--color-text-dim)]">
          {open ? "▾" : "▴"}
        </span>
      </button>
      <div className="max-h-80 overflow-auto border-t">
        {entries.length === 0 ? (
          <p className="p-3 text-xs text-[color:var(--color-text-dim)]">
            尚未加入任何課程。從課程卡片點「+ 候選」即可加入。
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li
                key={`${e.year}-${e.semester}-${e.courseCode}`}
                className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {e.snapshot.courseName}
                  </div>
                  <div className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                    {e.year}-{e.semester} · {e.courseCode}
                    {e.snapshot.deptName ? ` · ${e.snapshot.deptName}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => remove(e)}
                  className="shrink-0 text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)]"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {entries.length > 0 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <Link
            href="/schedule"
            className="rounded border px-2.5 py-1 text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]"
          >
            前往課表 →
          </Link>
          <button
            onClick={clear}
            className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)]"
          >
            全部清除
          </button>
        </div>
      )}
    </aside>
  );
}
