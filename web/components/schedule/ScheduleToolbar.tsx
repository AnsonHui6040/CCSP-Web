"use client";

import {
  clearSchedule,
  setScheduleMode,
  type ScheduleMode,
} from "@/lib/scheduleStore";
import type { ScheduleStats } from "@/lib/scheduleStats";

type Props = {
  mode: ScheduleMode;
  stats: ScheduleStats;
  conflictPairs: number;
};

const MODE_HINT: Record<ScheduleMode, { label: string; hint: string; tone: string }> =
  {
    planning: {
      label: "預排模式",
      hint: "預排模式允許衝堂，適合比較候選課程。",
      tone: "text-[color:var(--color-warn)]",
    },
    official: {
      label: "正式模式",
      hint: "正式模式用於確認最終課表。衝堂課程不可確認。",
      tone: "text-[color:var(--color-danger)]",
    },
  };

export function ScheduleToolbar({ mode, stats, conflictPairs }: Props) {
  const hint = MODE_HINT[mode];
  return (
    <div className="rounded-lg border bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">我的預排課表</h1>
          <p className="text-xs text-[color:var(--color-text-dim)]">
            候選池 → 課表 → 衝堂分析 → 正式確認
          </p>
        </div>
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

      <p className={`mt-3 text-xs ${hint.tone}`}>{hint.hint}</p>
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
  return (
    <button
      onClick={() => setScheduleMode(target)}
      className={`rounded border px-3 py-1 text-xs transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
          : "hover:border-[color:var(--color-text-dim)]"
      }`}
    >
      {MODE_HINT[target].label}
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
