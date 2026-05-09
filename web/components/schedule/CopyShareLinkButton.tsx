"use client";

import { useState } from "react";
import { getScheduleSnapshot } from "@/lib/scheduleStore";
import { buildShareUrl } from "@/lib/shareSchedule";

type Status = "idle" | "copied" | "error" | "fallback";

/**
 * Reads the current schedule from the store, encodes it as a share URL,
 * and copies it to the clipboard.
 *
 * Falls back to showing the URL in a selectable input if the Clipboard API
 * is unavailable.
 */
export function CopyShareLinkButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  function buildUrl() {
    const state = getScheduleSnapshot();
    return buildShareUrl(state, window.location.origin);
  }

  async function handleCopy() {
    const url = buildUrl();

    if (!navigator.clipboard) {
      setFallbackUrl(url);
      setStatus("fallback");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setFallbackUrl(url);
      setStatus("fallback");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleCopy}
        className="rounded border px-2.5 py-1 text-xs transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      >
        {status === "copied" ? "✓ 已複製" : "複製分享連結"}
      </button>
      {status === "error" && (
        <span className="text-xs text-[color:var(--color-danger)]">
          複製失敗
        </span>
      )}
      {status === "fallback" && fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="w-full rounded border bg-transparent px-2 py-0.5 text-xs text-[color:var(--color-text-dim)] focus:outline-none"
          aria-label="分享連結（請手動複製）"
        />
      )}
    </div>
  );
}
