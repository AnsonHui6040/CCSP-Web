"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Term } from "@/lib/types";
import { termKey } from "@/lib/format";

type Props = {
  terms: Term[];
  current: Term;
};

export function TermSwitcher({ terms, current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pick(t: Term) {
    const next = new URLSearchParams(params.toString());
    next.set("year", String(t.year));
    next.set("sem", String(t.semester));
    next.delete("offset");
    startTransition(() => {
      router.push(`/courses?${next.toString()}`);
    });
  }

  if (terms.length === 0) {
    return (
      <div className="text-xs text-[color:var(--color-text-dim)]">
        尚無學期資料，先執行 <code>importer scrape</code>
      </div>
    );
  }

  const currentKey = termKey(current.year, current.semester);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-dim)]">
        學期
      </span>
      {terms.map((t) => {
        const k = termKey(t.year, t.semester);
        const active = k === currentKey;
        return (
          <button
            key={k}
            onClick={() => pick(t)}
            disabled={pending}
            className={`rounded border px-2.5 py-1 text-sm transition ${
              active
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                : "hover:border-[color:var(--color-text-dim)]"
            }`}
          >
            {t.year}-{t.semester}
          </button>
        );
      })}
    </div>
  );
}
