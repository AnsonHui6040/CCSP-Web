"use client";

import { useEffect, useRef } from "react";
import {
  saveScrollPosition,
  useScrollRestoration,
} from "@/lib/scrollRestoration";

type Props = {
  /** Unique key for this scroll position — must include the current URL query. */
  scrollKey: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Client-side scroll container that saves and restores scrollTop when the user
 * navigates away and returns (e.g. course detail → back to /courses).
 *
 * Saving strategy:
 *  1. Passive scroll event listener (throttled via rAF) — continuous save.
 *  2. Click handler on any internal link — saves immediately before navigation.
 *
 * Restoration strategy: three attempts (rAF, 100ms, 400ms) + anchor fallback.
 */
export function CourseListScroll({ scrollKey, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useScrollRestoration(ref, scrollKey);

  // Save scrollTop immediately before any internal link navigation so we
  // always capture the position even if the scroll event hasn't fired yet.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const link = target.closest("a[href]");
      if (!link || !el.contains(link)) return;

      const courseEl = target.closest(
        "[data-course-code]",
      ) as HTMLElement | null;
      const courseCode = courseEl?.dataset.courseCode;
      saveScrollPosition(scrollKey, el.scrollTop, courseCode);
    };

    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [scrollKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
