"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref?: string;
  className?: string;
};

/**
 * Shows "上一頁" and navigates to the browser's previous history entry.
 * Falls back to `fallbackHref` when there is no previous page (e.g. the user
 * opened the current page directly or came from an external site).
 */
export function BackButton({
  fallbackHref = "/courses",
  className,
}: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={handleBack} className={className}>
      ← 上一頁
    </button>
  );
}
