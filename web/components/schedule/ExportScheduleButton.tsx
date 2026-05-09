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

      // Hide all scrollbars within the capture target so they don't appear
      // in the exported image.  Injected as a <style> tag so we don't touch
      // element styles and can clean up reliably in the finally block.
      const scrollbarStyle = document.createElement("style");
      scrollbarStyle.textContent = [
        "#ccsp-export-root *{scrollbar-width:none!important}",
        "#ccsp-export-root *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}",
      ].join("\n");
      el.id = "ccsp-export-root";
      document.head.appendChild(scrollbarStyle);

      // Wait for fonts + one paint cycle so layout is fully settled.
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      let dataUrl: string;
      try {
        dataUrl = await toPng(el, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: bg,
          // Capture the full scrollable extent, not just the visible viewport.
          width: el.scrollWidth,
          height: el.scrollHeight,
        });
      } finally {
        el.id = "";
        scrollbarStyle.remove();
      }
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
