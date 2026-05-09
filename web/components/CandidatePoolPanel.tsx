"use client";

import Link from "next/link";
import { useState } from "react";
import { useCandidatePool } from "./candidatePoolStore";

/**
 * Bottom-centre trigger button + pop-up panel on /courses.
 * The richer UI (with "add to schedule" buttons) lives on /schedule.
 */
export function CandidatePoolPanel() {
  const { entries, remove, clear, hydrated } = useCandidatePool();
  const [open, setOpen] = useState(false);

  if (!hydrated) return null;

  return (
    <>
      {/* ── Trigger pill ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-[color:var(--color-surface)] px-5 py-2 text-sm font-semibold shadow-lg hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        候選課程池
        {entries.length > 0 && (
          <span className="ml-2 rounded-full bg-[color:var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--color-bg)]">
            {entries.length}
          </span>
        )}
      </button>

      {/* ── Panel ──────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed bottom-16 left-1/2 z-50 flex w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-[color:var(--color-surface)] shadow-2xl"
            style={{ maxHeight: "min(28rem, 70vh)" }}
            aria-label="候選課程池"
            role="dialog"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">
                候選課程池
                {entries.length > 0 && (
                  <span className="ml-2 text-[color:var(--color-text-dim)]">
                    ({entries.length} 門)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>

            {/* Course list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <p className="p-4 text-xs text-[color:var(--color-text-dim)]">
                  尚未加入任何課程。從課程卡片點「+ 候選」即可加入。
                </p>
              ) : (
                <ul className="divide-y">
                  {entries.map((e) => (
                    <li
                      key={`${e.year}-${e.semester}-${e.courseCode}`}
                      className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {e.snapshot.courseName}
                        </div>
                        <div className="font-mono text-[10px] text-[color:var(--color-text-dim)]">
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

            {/* Footer */}
            {entries.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t px-4 py-2.5 text-xs">
                <Link
                  href="/schedule"
                  className="rounded border px-3 py-1 text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]"
                  onClick={() => setOpen(false)}
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
        </>
      )}
    </>
  );
}

