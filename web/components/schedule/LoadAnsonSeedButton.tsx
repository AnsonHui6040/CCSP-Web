"use client";

import { ANSON_SCHEDULE_SEED } from "@/lib/ansonScheduleSeed";
import { addSnapshotToSchedule, clearSchedule } from "@/lib/scheduleStore";

/**
 * Developer/seed button — loads Anson's correct 114-2 schedule.
 * Clears the current schedule after confirmation, then adds all seed courses.
 * Intended for manual testing and demonstration only.
 */
export function LoadAnsonSeedButton() {
  function handleLoad() {
    const ok = confirm(
      "這會取代目前課表，確定載入 Anson 的正確課表嗎？\n\n共 5 門課（114 學年度第 2 學期）",
    );
    if (!ok) return;
    clearSchedule();
    for (const snapshot of ANSON_SCHEDULE_SEED) {
      addSnapshotToSchedule(snapshot);
    }
  }

  return (
    <button
      onClick={handleLoad}
      className="mt-2 w-full rounded border border-dashed border-[color:var(--color-border)] px-2 py-1.5 text-xs text-[color:var(--color-text-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
    >
      ⬇ 載入 Anson 正確課表
    </button>
  );
}
