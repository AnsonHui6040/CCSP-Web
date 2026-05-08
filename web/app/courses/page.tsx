import { Suspense } from "react";
import {
  listDepartments,
  listTerms,
  searchCourses,
} from "@/lib/queries";
import type { Term } from "@/lib/types";
import { CourseCard } from "@/components/CourseCard";
import { SearchForm } from "@/components/SearchForm";
import { FilterSidebar } from "@/components/FilterSidebar";
import { TermSwitcher } from "@/components/TermSwitcher";
import { CandidatePoolPanel } from "@/components/CandidatePoolPanel";
import { Navbar } from "@/components/Navbar";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
function pickInt(v: string | string[] | undefined): number | undefined {
  const s = pickStr(v);
  if (s === undefined) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const terms = listTerms();
  const fallbackTerm: Term = terms[0] ?? { year: 114, semester: 1 };
  const term: Term = {
    year: pickInt(sp.year) ?? fallbackTerm.year,
    semester:
      ((pickInt(sp.sem) as 1 | 2) ?? fallbackTerm.semester) === 2 ? 2 : 1,
  };

  const q = pickStr(sp.q) ?? "";
  const deptCode = pickStr(sp.dept);
  const weekday = pickInt(sp.weekday);
  const requiredOnly = pickStr(sp.required) === "1";
  const hasOpening = pickStr(sp.open) === "1";
  const englishTaught = pickStr(sp.english) === "1";
  const remote = pickStr(sp.remote) === "1";
  const restrictedOnly = pickStr(sp.restricted) === "1";
  const hideNoOnline = pickStr(sp.hideNoOnline) === "1";
  const hideManual = pickStr(sp.hideManual) === "1";
  const hideNotCountGraduation = pickStr(sp.hideNoGrad) === "1";
  const riskRaw = pickStr(sp.risk);
  const riskLevel: "low" | "medium" | "high" | undefined =
    riskRaw === "low" || riskRaw === "medium" || riskRaw === "high"
      ? riskRaw
      : undefined;
  const offset = pickInt(sp.offset) ?? 0;
  const limit = 60;

  const { rows, total } = searchCourses({
    q: q || undefined,
    year: term.year,
    semester: term.semester,
    deptCode,
    weekday,
    requiredOnly,
    hasOpening,
    englishTaught,
    remote,
    restrictedOnly,
    hideNoOnline,
    hideManual,
    hideNotCountGraduation,
    riskLevel,
    limit,
    offset,
  });

  const departments = listDepartments(term);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, total);

  return (
    <>
    <Navbar active="courses" />
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">課程搜尋</h1>
          <p className="text-sm text-[color:var(--color-text-dim)]">
            東海大學 {term.year} 學年度 第 {term.semester} 學期
          </p>
        </div>
        <TermSwitcher terms={terms} current={term} />
      </header>

      <div className="mb-5">
        <SearchForm initialQuery={q} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterSidebar departments={departments} />

        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm text-[color:var(--color-text-dim)]">
              共 <span className="text-[color:var(--color-text)]">{total}</span> 門
              {total > 0 && (
                <>
                  {" "}
                  · 顯示 {showingFrom}–{showingTo}
                </>
              )}
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <Suspense>
              <ul className="grid gap-3">
                {rows.map((c) => (
                  <li key={c.id}>
                    <CourseCard course={c} />
                  </li>
                ))}
              </ul>
            </Suspense>
          )}

          <Pagination total={total} offset={offset} limit={limit} sp={sp} />
        </section>
      </div>

      <CandidatePoolPanel />
    </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed bg-[color:var(--color-surface)] p-10 text-center">
      <p className="text-sm text-[color:var(--color-text-dim)]">
        沒有符合條件的課程。
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-text-dim)]">
        如果這是空資料庫，請先執行：
        <code className="ml-1 rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5">
          python -m ccsp_importer.cli scrape --year 114 --semester 1
        </code>
      </p>
    </div>
  );
}

function Pagination({
  total,
  offset,
  limit,
  sp,
}: {
  total: number;
  offset: number;
  limit: number;
  sp: SearchParams;
}) {
  if (total <= limit) return null;
  const next = offset + limit < total ? offset + limit : null;
  const prev = offset - limit >= 0 ? offset - limit : null;

  function url(o: number) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") p.set(k, v);
    }
    p.set("offset", String(o));
    return `/courses?${p.toString()}`;
  }

  return (
    <nav className="mt-6 flex justify-between text-sm">
      <a
        href={prev !== null ? url(prev) : "#"}
        className={`rounded border px-3 py-1.5 ${prev !== null ? "hover:border-[color:var(--color-text-dim)]" : "pointer-events-none opacity-40"}`}
      >
        ← 上一頁
      </a>
      <a
        href={next !== null ? url(next) : "#"}
        className={`rounded border px-3 py-1.5 ${next !== null ? "hover:border-[color:var(--color-text-dim)]" : "pointer-events-none opacity-40"}`}
      >
        下一頁 →
      </a>
    </nav>
  );
}
