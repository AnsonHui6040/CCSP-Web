import { Suspense } from "react";
import {
  getAvailableTerms,
  getTermDataFreshness,
  listDepartments,
  listTerms,
  searchCourses,
} from "@/lib/queries";
import type { Term } from "@/lib/types";
import { inferCurrentAcademicTerm, termEquals } from "@/lib/terms";
import { CourseCard } from "@/components/CourseCard";
import { SearchForm } from "@/components/SearchForm";
import { FilterSidebar } from "@/components/FilterSidebar";
import { TermSwitcher } from "@/components/TermSwitcher";
import { CandidatePoolPanel } from "@/components/CandidatePoolPanel";
import { CourseListScroll } from "@/components/CourseListScroll";
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

  const availableTerms = getAvailableTerms();
  const terms = listTerms();
  // Infer the current academic term from today's date
  const inferredTerm = inferCurrentAcademicTerm(new Date());
  // Pick default: inferred term if available in DB, otherwise first available
  const availableInferred = availableTerms.find(
    (t) => t.year === inferredTerm.year && t.semester === inferredTerm.semester,
  );
  const fallbackTerm: Term = availableInferred
    ? { year: availableInferred.year, semester: availableInferred.semester }
    : (terms[0] ?? { year: 114, semester: 1 });

  const term: Term = {
    year: pickInt(sp.year) ?? fallbackTerm.year,
    semester:
      ((pickInt(sp.sem) as 1 | 2) ?? fallbackTerm.semester) === 2 ? 2 : 1,
  };

  const freshness = getTermDataFreshness(term.year, term.semester as 1 | 2);
  // Show a warning when the user is viewing a term that is not the inferred
  // current term AND the inferred current term exists in the DB.
  const viewingOlderTerm =
    !termEquals(term, inferredTerm) && availableInferred != null;
  // Show a warning if the inferred current term is missing from the DB.
  const currentTermMissing =
    termEquals(term, inferredTerm) ? false : availableInferred == null;

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

  // Build a stable scroll-restoration key from all active search params.
  // Including every filter ensures different queries never share a scroll position.
  const scrollKeyParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") scrollKeyParams.set(k, v);
  }
  scrollKeyParams.sort();
  const scrollKey = `/courses?${scrollKeyParams.toString()}`;

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
    <main className="mx-auto flex h-[calc(100vh-2.75rem)] max-w-7xl flex-col px-6 pt-6">
      <header className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">課程搜尋</h1>
          <p className="text-sm text-[color:var(--color-text-dim)]">
            東海大學 {term.year} 學年度 第 {term.semester} 學期
          </p>
          {freshness.lastScrapedAt && (
            <p className="mt-0.5 text-xs text-[color:var(--color-text-dim)]">
              資料更新：{new Date(freshness.lastScrapedAt).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}　來源：course.thu.edu.tw
              {freshness.status === "stale" && (
                <span className="ml-2 text-[color:var(--color-warn,#b45309)]">（資料較舊）</span>
              )}
            </p>
          )}
        </div>
        <TermSwitcher terms={terms} current={term} />
      </header>

      {/* Warning: viewing an older term while a newer one is available */}
      {viewingOlderTerm && (
        <div className="mb-4 shrink-0 rounded-md border border-[color:var(--color-warn,#b45309)] bg-[color:var(--color-warn-bg,#451a03)] px-4 py-2.5 text-sm text-[color:var(--color-warn,#b45309)]">
          目前顯示的是 {term.year}-{term.semester} 資料，可能不是目前學期（{inferredTerm.year}-{inferredTerm.semester}）。請切換學期以查看最新課程。
        </div>
      )}

      {/* Warning: inferred current term not yet imported */}
      {currentTermMissing && (
        <div className="mb-4 shrink-0 rounded-md border border-[color:var(--color-warn,#b45309)] bg-[color:var(--color-warn-bg,#451a03)] px-4 py-2.5 text-sm text-[color:var(--color-warn,#b45309)]">
          目前學期（{inferredTerm.year}-{inferredTerm.semester}）資料尚未匯入。請先執行：
          <code className="ml-2 rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[color:var(--color-text)]">
            python -m ccsp_importer.cli scrape --year {inferredTerm.year} --semester {inferredTerm.semester}
          </code>
        </div>
      )}

      <div className="mb-4 shrink-0">
        <SearchForm initialQuery={q} />
      </div>

      <div className="grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[16rem_1fr]">
        <FilterSidebar departments={departments} />

        <CourseListScroll scrollKey={scrollKey} className="min-h-0 min-w-0 overflow-y-auto pb-6">
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
        </CourseListScroll>
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
