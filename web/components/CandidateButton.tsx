"use client";

import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";
import { useCandidatePool } from "./candidatePoolStore";

type Props = { course: Course };

export function CandidateButton({ course }: Props) {
  const { has, toggle, hydrated } = useCandidatePool();
  // Avoid hydration mismatch: render a stable initial state on the server,
  // then flip once we've read localStorage on the client.
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (hydrated) setActive(has(course));
  }, [hydrated, has, course]);

  function onClick() {
    toggle(course);
    setActive((v) => !v);
  }

  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
          : "hover:border-[color:var(--color-text-dim)]"
      }`}
      title={active ? "從候選池移除" : "加入候選池"}
    >
      {active ? "已候選" : "+ 候選"}
    </button>
  );
}
