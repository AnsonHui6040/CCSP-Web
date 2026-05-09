"use client";

import { useState } from "react";
import Link from "next/link";
import { courseDetailHref } from "@/lib/courseLinks";
import {
  addSnapshotToSchedule,
  confirmCourse,
  isCourseInSchedule,
  removeCourseFromSchedule,
  unconfirmCourse,
  type ConfirmResult,
  type ScheduleMode,
  type StoredScheduleCourse,
} from "@/lib/scheduleStore";
import type { Conflict, CourseLike } from "@/lib/conflict";
import type { ScheduleStats } from "@/lib/scheduleStats";
import { useCandidatePool } from "@/components/candidatePoolStore";
import { ConflictList } from "./ConflictList";
import { NoTimeCourseList } from "./NoTimeCourseList";
import { ScheduleStatsPanel } from "./ScheduleStatsPanel";

type Props = {
  courses: StoredScheduleCourse[];
  conflicts: Conflict[];
  linkBack: WeakMap<CourseLike, StoredScheduleCourse>;
  stats: ScheduleStats;
  mode: ScheduleMode;
};

type Tab = "candidates" | "scheduled" | "conflicts" | "notime" | "stats";

export function ScheduleSidebar(props: Props) {
  const [tab, setTab] = useState<Tab>("candidates");
  const noTime = props.courses.filter((c) => c.snapshot.timeSlots.length === 0);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border bg-[color:var(--color-surface)] p-3">
      <nav className="mb-3 flex shrink-0 flex-wrap gap-1 text-xs">
        <TabButton current={tab} value="candidates" onSelect={setTab} label="候選" />
        <TabButton
          current={tab}
          value="scheduled"
          onSelect={setTab}
          label={`已加入 (${props.courses.length})`}
        />
        <TabButton
          current={tab}
          value="conflicts"
          onSelect={setTab}
          label={`衝堂 (${props.conflicts.length})`}
        />
        <TabButton
          current={tab}
          value="notime"
          onSelect={setTab}
          label={`無時間 (${noTime.length})`}
        />
        <TabButton current={tab} value="stats" onSelect={setTab} label="分析" />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {tab === "candidates" && <CandidatesTab />}
      {tab === "scheduled" && (
        <ScheduledTab courses={props.courses} mode={props.mode} />
      )}
      {tab === "conflicts" && (
        props.mode === "official" && props.conflicts.length === 0 ? (
          <p className="rounded border border-dashed p-3 text-xs text-[color:var(--color-text-dim)]">
            目前正式課表沒有衝堂。
          </p>
        ) : (
          <ConflictList
            conflicts={props.conflicts}
            linkBack={props.linkBack}
            mode={props.mode}
          />
        )
      )}
      {tab === "notime" && (
        props.mode === "official" && noTime.length > 0 ? (
          <p className="rounded border border-dashed border-[color:var(--color-warn)] p-3 text-xs text-[color:var(--color-warn)]">
            仍有未排定時間課程，請回到預排模式處理。
          </p>
        ) : (
          <NoTimeCourseList courses={noTime} />
        )
      )}
      {tab === "stats" && <ScheduleStatsPanel stats={props.stats} />}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Tab components

function CandidatesTab() {
  const { entries, hydrated, remove } = useCandidatePool();
  const [flash, setFlash] = useState<string | null>(null);

  if (!hydrated) return null;
  if (entries.length === 0) {
    return (
      <p className="rounded border border-dashed p-3 text-xs text-[color:var(--color-text-dim)]">
        候選池目前是空的。請先到{" "}
        <a href="/courses" className="text-[color:var(--color-accent)] underline">
          課程搜尋
        </a>{" "}
        加入候選。
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {entries.map((e) => {
        const inSched = isCourseInSchedule(e);
        return (
          <li
            key={`${e.year}-${e.semester}-${e.courseCode}`}
            className="rounded border bg-[color:var(--color-surface-2)] p-2"
          >
            <div className="truncate font-medium">{e.snapshot.courseName}</div>
            <div className="font-mono text-[10px] text-[color:var(--color-text-dim)]">
              {e.year}-{e.semester} · {e.courseCode}
              {e.snapshot.credits !== null ? ` · ${e.snapshot.credits} 學分` : ""}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (!inSched) {
                    addSnapshotToSchedule(e.snapshot);
                    setFlash(e.courseCode);
                    setTimeout(() => setFlash(null), 800);
                  }
                }}
                disabled={inSched}
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  inSched
                    ? "border-[color:var(--color-border)] text-[color:var(--color-text-dim)]"
                    : flash === e.courseCode
                      ? "border-[color:var(--color-ok)] bg-[color:var(--color-ok)]/15 text-[color:var(--color-ok)]"
                      : "border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
                }`}
              >
                {inSched ? "已加入" : "加入課表"}
              </button>
              <div className="flex items-center gap-2">
                <Link
                  href={courseDetailHref(e)}
                  className="text-[10px] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] hover:underline"
                >
                  詳細資料
                </Link>
                <button
                  onClick={() => remove(e)}
                  className="text-[10px] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)]"
                >
                  從候選移除
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ScheduledTab({
  courses,
  mode,
}: {
  courses: StoredScheduleCourse[];
  mode: ScheduleMode;
}) {
  const [error, setError] = useState<string | null>(null);
  if (courses.length === 0) {
    return (
      <p className="rounded border border-dashed p-3 text-xs text-[color:var(--color-text-dim)]">
        尚未加入任何課程。
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded border border-[color:var(--color-danger)]/60 bg-[color:var(--color-danger)]/10 p-2 text-[11px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      <ul className="space-y-1.5 text-xs">
        {courses.map((entry) => (
          <li
            key={`${entry.year}-${entry.semester}-${entry.courseCode}`}
            className="rounded border bg-[color:var(--color-surface-2)] p-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">
                {entry.snapshot.courseName}
              </span>
              {entry.status === "confirmed" && (
                <span className="shrink-0 rounded bg-[color:var(--color-accent)]/30 px-1 text-[9px] uppercase text-[color:var(--color-accent)]">
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
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <Link
                href={courseDetailHref(entry)}
                className="mr-auto text-[10px] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] hover:underline"
              >
                詳細資料
              </Link>
              {entry.status === "confirmed" ? (
                <button
                  onClick={() => unconfirmCourse(entry)}
                  className="rounded border px-2 py-0.5 text-[11px] hover:border-[color:var(--color-text-dim)]"
                >
                  取消確認
                </button>
              ) : (
                <button
                  onClick={() => {
                    const r: ConfirmResult = confirmCourse(entry);
                    if (!r.ok && r.reason === "conflict") {
                      const names = r.conflictsWith
                        .map((c) => c.snapshot.courseName)
                        .join("、");
                      setError(
                        `${mode === "official" ? "正式模式" : ""}無法確認「${entry.snapshot.courseName}」，與已確認課程衝堂：${names}`,
                      );
                      setTimeout(() => setError(null), 5000);
                    } else if (r.ok) {
                      setError(null);
                    }
                  }}
                  className="rounded border border-[color:var(--color-accent)] px-2 py-0.5 text-[11px] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
                >
                  確認
                </button>
              )}
              <button
                onClick={() => removeCourseFromSchedule(entry)}
                className="text-[10px] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)]"
              >
                移除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabButton<T extends string>({
  current,
  value,
  onSelect,
  label,
}: {
  current: T;
  value: T;
  onSelect: (v: T) => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`rounded border px-2 py-0.5 text-[11px] transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
          : "hover:border-[color:var(--color-text-dim)]"
      }`}
    >
      {label}
    </button>
  );
}
