"use client";

import { useRef, useState } from "react";
import type React from "react";

type Props = {
  targetRef: React.RefObject<HTMLElement | null>;
  filename?: string;
};

/**
 * Captures the WeeklyGrid DOM node via html-to-image and embeds it into
 * an A4-landscape PDF using jsPDF.  Both libraries are lazy-loaded so
 * they don't inflate the initial bundle.
 */
export function ExportSchedulePdfButton({
  targetRef,
  filename = "ccsp-schedule.pdf",
}: Props) {
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
      // Lazy-load to keep initial bundle small
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      if (abortRef.current) return;

      // Match page background colour so dark-mode doesn't produce
      // a transparent / illegible image embedded in the PDF.
      const bg =
        window.getComputedStyle(document.documentElement)
          .getPropertyValue("--color-bg")
          .trim() || "#0b0d10";

      // Hide all scrollbars within the capture target so they don't appear
      // in the exported PDF.  Injected as a <style> tag so we can clean up
      // reliably in the finally block.
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
      // Capture the full scrollable extent, not just the visible viewport.
      const captureW = el.scrollWidth;
      const captureH = el.scrollHeight;
      try {
        dataUrl = await toPng(el, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: bg,
          width: captureW,
          height: captureH,
        });
      } finally {
        el.id = "";
        scrollbarStyle.remove();
      }
      if (abortRef.current) return;

      // A4 landscape in mm
      const pageW = 297;
      const pageH = 210;
      const margin = 8; // mm
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      // Read the actual rendered pixel dimensions from the element
      const aspectRatio = captureW / captureH;

      // Fit the image so it fills as much of the page as possible
      // without overflow or distortion.
      let imgW = maxW;
      let imgH = imgW / aspectRatio;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH * aspectRatio;
      }

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;
      pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH);
      pdf.save(filename);

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
        {status === "exporting" ? "匯出中…" : "匯出 PDF"}
      </button>
      {status === "error" && (
        <span className="text-xs text-[color:var(--color-danger)]">
          匯出失敗，請稍後再試。
        </span>
      )}
    </div>
  );
}
