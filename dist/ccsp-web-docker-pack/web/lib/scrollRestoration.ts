import { useEffect } from "react";
import type { RefObject } from "react";

const PREFIX = "ccsp.scroll:";

export function saveScrollPosition(
  key: string,
  scrollTop: number,
  anchorCourseCode?: string,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      PREFIX + key,
      JSON.stringify({ scrollTop, anchorCourseCode }),
    );
  } catch {
    // ignore (private browsing, storage full, etc.)
  }
}

export function readScrollPosition(
  key: string,
): { scrollTop: number; anchorCourseCode?: string } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      typeof (parsed as Record<string, unknown>).scrollTop !== "number"
    ) {
      return null;
    }
    const p = parsed as { scrollTop: number; anchorCourseCode?: unknown };
    return {
      scrollTop: p.scrollTop,
      anchorCourseCode:
        typeof p.anchorCourseCode === "string" ? p.anchorCourseCode : undefined,
    };
  } catch {
    return null;
  }
}

export function clearScrollPosition(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Saves scroll position on scroll (throttled via rAF), and restores it on
 * mount. The ref should point to the custom scroll container element.
 */
export function useScrollRestoration(
  ref: RefObject<HTMLElement | null>,
  key: string,
): void {
  // Save on scroll (throttled via requestAnimationFrame)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId: ReturnType<typeof requestAnimationFrame> | undefined;
    const handler = () => {
      if (rafId !== undefined) return;
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        if (ref.current) {
          saveScrollPosition(key, ref.current.scrollTop);
        }
      });
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => {
      el.removeEventListener("scroll", handler);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [ref, key]);

  // Restore on mount
  useEffect(() => {
    const saved = readScrollPosition(key);
    if (!saved) return;

    const tryRestore = () => {
      if (ref.current) {
        ref.current.scrollTop = saved.scrollTop;
      }
    };

    // Attempt 1: after first paint
    requestAnimationFrame(tryRestore);

    // Attempt 2: 100ms (hydration may still be in progress)
    const t1 = setTimeout(tryRestore, 100);

    // Attempt 3: 400ms (slower devices / larger lists)
    const t2 = setTimeout(tryRestore, 400);

    // Anchor fallback: if scrollTop restoration drifted significantly,
    // scroll the anchored card into view as a best-effort recovery.
    const t3 = setTimeout(() => {
      if (!ref.current || !saved.anchorCourseCode) return;
      const diff = Math.abs(ref.current.scrollTop - saved.scrollTop);
      if (diff > 100) {
        const el = ref.current.querySelector(
          `[data-course-code="${saved.anchorCourseCode}"]`,
        );
        el?.scrollIntoView({ block: "center" });
      }
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // ref is stable (from useRef); key changes cause full re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
