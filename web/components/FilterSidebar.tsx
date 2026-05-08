"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Department = { code: string; name: string; count: number };

type Props = {
  departments: Department[];
};

const WEEKDAYS = [
  { value: "", label: "不限" },
  { value: "1", label: "一" },
  { value: "2", label: "二" },
  { value: "3", label: "三" },
  { value: "4", label: "四" },
  { value: "5", label: "五" },
  { value: "6", label: "六" },
];

export function FilterSidebar({ departments }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("offset");
    startTransition(() => {
      router.push(`/courses?${next.toString()}`);
    });
  }

  const weekday = params.get("weekday") ?? "";
  const dept = params.get("dept") ?? "";
  const requiredOnly = params.get("required") === "1";
  const hasOpening = params.get("open") === "1";

  return (
    <aside className="space-y-5 text-sm">
      <Section title="星期">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const active = weekday === w.value;
            return (
              <button
                key={w.value}
                onClick={() => update({ weekday: w.value || null })}
                className={`rounded border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                    : "hover:border-[color:var(--color-text-dim)]"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="開課單位">
        <select
          value={dept}
          onChange={(e) => update({ dept: e.target.value || null })}
          className="w-full rounded-md border bg-[color:var(--color-surface)] px-2 py-1.5"
        >
          <option value="">全部</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name} ({d.count})
            </option>
          ))}
        </select>
      </Section>

      <Section title="基本">
        <Toggle
          label="只看必修"
          checked={requiredOnly}
          onChange={(v) => update({ required: v ? "1" : null })}
        />
        <Toggle
          label="只看尚有名額"
          checked={hasOpening}
          onChange={(v) => update({ open: v ? "1" : null })}
        />
      </Section>

      <Section title="風險等級">
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: "", label: "全部" },
            { v: "low", label: "低" },
            { v: "medium", label: "中" },
            { v: "high", label: "高" },
          ].map((opt) => {
            const active = (params.get("risk") ?? "") === opt.v;
            return (
              <button
                key={opt.v || "all"}
                onClick={() => update({ risk: opt.v || null })}
                className={`rounded border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                    : "hover:border-[color:var(--color-text-dim)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="課程類型">
        <Toggle
          label="只看英文授課"
          checked={params.get("english") === "1"}
          onChange={(v) => update({ english: v ? "1" : null })}
        />
        <Toggle
          label="只看遠距課程"
          checked={params.get("remote") === "1"}
          onChange={(v) => update({ remote: v ? "1" : null })}
        />
        <Toggle
          label="只看有選課限制"
          checked={params.get("restricted") === "1"}
          onChange={(v) => update({ restricted: v ? "1" : null })}
        />
      </Section>

      <Section title="排除">
        <Toggle
          label="隱藏不可網選"
          checked={params.get("hideNoOnline") === "1"}
          onChange={(v) => update({ hideNoOnline: v ? "1" : null })}
        />
        <Toggle
          label="隱藏人工加選"
          checked={params.get("hideManual") === "1"}
          onChange={(v) => update({ hideManual: v ? "1" : null })}
        />
        <Toggle
          label="隱藏不列畢業學分"
          checked={params.get("hideNoGrad") === "1"}
          onChange={(v) => update({ hideNoGrad: v ? "1" : null })}
        />
      </Section>

      {pending && (
        <div className="text-xs text-[color:var(--color-text-dim)]">
          重新載入課程…
        </div>
      )}
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-dim)]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[color:var(--color-accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
