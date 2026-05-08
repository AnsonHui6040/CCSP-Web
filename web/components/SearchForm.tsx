"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  initialQuery: string;
};

/** Single text input that updates ?q=... and triggers a server-rendered re-fetch. */
export function SearchForm({ initialQuery }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("offset");
    startTransition(() => {
      router.push(`/courses?${next.toString()}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜尋課名、教師、選課代碼…"
        className="flex-1 rounded-md border bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
      />
      <button
        type="submit"
        className="rounded-md border bg-[color:var(--color-surface-2)] px-4 py-2 text-sm font-medium hover:border-[color:var(--color-accent)] disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "搜尋中…" : "搜尋"}
      </button>
    </form>
  );
}
