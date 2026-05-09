"use client";

import { useRef, useState } from "react";
import type React from "react";

type Props = {
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
};

/**
 * Client component that captures a DOM node via html-to-image and
 * triggers a PNG download.  html-to-image is loaded lazily so it
 * doesn't inflate the initial bundle.
 */
export function ExportScheduleButton({ targetRef, filename = "ccsp-schedule.png" }: Props) {
  const [status, setStatus] = useState<"idle" | "exporting" | "error">("idle");
  const abortRef = useRef(false);

  async function handleExport() {
    const el = targetRef.current;
    if (!el) {
      setStatus("error");
      return;
    }
    setStatus("exporting");
    abortRef.current = false;
    try {
      // Lazy-load html-to-image so it doesn't affect initial bundle
      const { toPng } = await import("html-to-image");
      if (abortRef.current) return;

      // Read the element's computed background colour so dark-mode doesn't
      // produce a transparent / illegible image.
      const bg =
        window.getComputedStyle(document.documentElement)
          .getPropertyValue("--color-bg")
          .trim() || "#0b0d10";

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: bg,
      });
      if (abortRef.current) return;

      // Trigger download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      setStatus("idle");
    } catch {
      if (!abortRef.current) setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={status === "exporting"}
        className="rounded border px-2.5 py-1 text-xs transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50"
      >
        {status === "exporting" ? "匯出中…" : "匯出 PNG"}
      </button>
      {status === "error" && (
        <span className="text-xs text-[color:var(--color-danger)]">
          匯出失敗，請稍後再試。
        </span>
      )}
    </div>
  );
}
