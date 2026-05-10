"use client";

import type React from "react";
import {
  clearSchedule,
  setScheduleMode,
  type ScheduleMode,
} from "@/lib/scheduleStore";
import type { ScheduleStats } from "@/lib/scheduleStats";
import { Contributors } from "@/components/Contributors";

type Props = {
  mode: ScheduleMode;
  stats: ScheduleStats;
  conflictPairs: number;
  exportButton?: React.ReactNode;
  /** Optional term label displayed under the heading e.g. "114 學年度第 2 學期" */
  termLabel?: string;
};

export function ScheduleToolbar({ mode, stats, conflictPairs, exportButton, termLabel }: Props) {
  // Build the mode status line shown under the stat grid.
  let statusText: string | null = null;
  let statusTone = "";
  if (mode === "planning") {
    statusText = "預排模式允許衝堂，適合比較候選課程。";
    statusTone = "text-[color:var(--color-warn)]";
  } else {
    // official
    if (conflictPairs > 0) {
      statusText = "正式模式中仍有衝堂，請返回預排模式調整。";
      statusTone = "text-[color:var(--color-danger)]";
    } else if (stats.noTimeCourses > 0) {
      statusText = "仍有未排定時間課程，請回到預排模式處理。";
      statusTone = "text-[color:var(--color-warn)]";
    }
    // No message when official + no issues — the grid speaks for itself.
  }

  return (
    <div className="rounded-lg border bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">我的課表</h1>
          <p className="text-xs text-[color:var(--color-text-dim)]">
            {mode === "planning"
              ? "候選池 → 課表 → 衝堂分析 → 正式確認"
              : "正式模式：用於確認最終課表"}
          </p>
          {termLabel && (
            <p className="mt-0.5 text-xs text-[color:var(--color-text-dim)]">
              {termLabel}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Contributors />
          <div className="flex flex-wrap items-center gap-1.5">
            <ModeButton current={mode} target="planning" />
            <ModeButton current={mode} target="official" />
            <button
              onClick={() => {
                if (confirm("確定要清空整個課表嗎？")) clearSchedule();
              }}
              className="rounded border px-2.5 py-1 text-xs text-[color:var(--color-text-dim)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
            >
              清空課表
            </button>
            {exportButton}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="總課程" value={stats.totalCourses} />
        <Stat
          label="總學分"
          value={stats.totalCredits}
          sub={`已確認 ${stats.confirmedCredits} · 預排 ${stats.plannedCredits}`}
        />
        <Stat
          label="無時間課程"
          value={stats.noTimeCourses}
          sub={`${stats.noTimeCredits} 學分`}
        />
        <Stat
          label="衝堂"
          value={conflictPairs}
          tone={
            conflictPairs === 0
              ? "ok"
              : mode === "official"
                ? "danger"
                : "warn"
          }
        />
      </div>

      {statusText && (
        <p className={`mt-3 text-xs ${statusTone}`}>{statusText}</p>
      )}
    </div>
  );
}

function ModeButton({
  current,
  target,
}: {
  current: ScheduleMode;
  target: ScheduleMode;
}) {
  const active = current === target;
  const label = target === "planning" ? "預排模式" : "正式模式";
  return (
    <button
      onClick={() => setScheduleMode(target)}
      className={`rounded border px-3 py-1 text-xs transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
          : "hover:border-[color:var(--color-text-dim)]"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "text-[color:var(--color-ok)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : tone === "danger"
          ? "text-[color:var(--color-danger)]"
          : "";
  return (
    <div className="rounded border bg-[color:var(--color-surface-2)] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold ${toneClass}`}>{value}</div>
      {sub && (
        <div className="text-[10px] text-[color:var(--color-text-dim)]">
          {sub}
        </div>
      )}
    </div>
  );
}
