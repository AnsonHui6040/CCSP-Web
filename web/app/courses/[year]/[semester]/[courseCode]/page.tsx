import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { CourseDetailActions } from "@/components/CourseDetailActions";
import { getCourseWithDetails } from "@/lib/queries";
import { TAG_DEFS_BY_KEY, sortTagKeys } from "@/lib/tags";
import {
  formatCredits,
  formatTeachers,
  formatTimeSlots,
  remainingTier,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{
  year: string;
  semester: string;
  courseCode: string;
}>;

const TIER_CLASS = {
  ok: "text-[color:var(--color-ok)]",
  warn: "text-[color:var(--color-warn)]",
  danger: "text-[color:var(--color-danger)]",
  unknown: "text-[color:var(--color-text-dim)]",
} as const;

export default async function CourseDetailPage({
  params,
}: {
  params: Params;
}) {
  const { year, semester, courseCode } = await params;
  const yearN = Number(year);
  const semN = Number(semester);
  if (!Number.isFinite(yearN) || (semN !== 1 && semN !== 2)) {
    return notFound();
  }
  const result = getCourseWithDetails(
    { year: yearN, semester: semN as 1 | 2 },
    courseCode,
  );
  if (!result) return notFound();
  const { course, detail } = result;
  const tier = remainingTier(course);

  return (
    <>
      <Navbar active="courses" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Link
          href="/courses"
          className="mb-3 inline-block text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)]"
        >
          ← 返回課程搜尋
        </Link>

        <header className="rounded-lg border bg-[color:var(--color-surface)] p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xs text-[color:var(--color-text-dim)]">
              {course.year}-{course.semester} · {course.courseCode}
            </span>
            {course.requiredOrElective && (
              <span className="rounded border bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[10px]">
                {course.requiredOrElective}
              </span>
            )}
            {course.deptName && (
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-[color:var(--color-text-dim)]">
                {course.deptName}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {course.courseName}
          </h1>
          {course.courseNameEn && (
            <p className="text-sm text-[color:var(--color-text-dim)]">
              {course.courseNameEn}
            </p>
          )}

          {course.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sortTagKeys(course.tags).map((k) => {
                const def = TAG_DEFS_BY_KEY[k];
                if (!def) return null;
                const cls =
                  def.level === "high"
                    ? "border-[color:var(--color-danger)]/60 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
                    : def.level === "medium"
                      ? "border-[color:var(--color-warn)]/50 bg-[color:var(--color-warn)]/10 text-[color:var(--color-warn)]"
                      : "border bg-[color:var(--color-surface-2)] text-[color:var(--color-text-dim)]";
                return (
                  <span
                    key={k}
                    className={`rounded px-1.5 py-0.5 text-[11px] ${cls}`}
                  >
                    {def.display}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-4">
            <Card title="基本資訊">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Field label="教師">{formatTeachers(course)}</Field>
                <Field label="學分">{formatCredits(course)}</Field>
                <Field label="名額">
                  <span className={TIER_CLASS[tier]}>
                    {course.remaining ?? "—"}
                    {course.capacity !== null && (
                      <span className="text-[color:var(--color-text-dim)]">
                        {" "}
                        / {course.capacity}
                      </span>
                    )}
                  </span>
                </Field>
                <Field label="時間地點" wide>
                  {formatTimeSlots(course.timeSlots)}
                </Field>
              </dl>
            </Card>

            {course.rules.length > 0 && (
              <Card title="選課限制">
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-[color:var(--color-warn)]">
                  {course.rules.map((r, i) => (
                    <li key={i}>{r.value}</li>
                  ))}
                </ul>
              </Card>
            )}

            {course.rawNote && (
              <Card title="選課備註（自系所列表）">
                <p className="whitespace-pre-line text-sm text-[color:var(--color-text-dim)]">
                  {course.rawNote}
                </p>
              </Card>
            )}

            {detail?.detailedNote && detail.detailedNote !== course.rawNote && (
              <Card title="選課備註（詳細頁）">
                <p className="whitespace-pre-line text-sm">
                  {detail.detailedNote}
                </p>
              </Card>
            )}

            <DetailSection
              title="教育目標"
              content={detail?.teachingGoal}
              missingHint={detail ? "詳細頁尚未取得本欄位" : undefined}
            />

            {detail?.courseDescription &&
              detail.courseDescription !== detail.teachingGoal && (
                <Card title="課程概述">
                  <p className="whitespace-pre-line text-sm">
                    {detail.courseDescription}
                  </p>
                </Card>
              )}

            <Card title="評分方式">
              {detail && detail.gradingPolicy.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[color:var(--color-text-dim)]">
                      <th className="py-1 text-left text-xs font-normal">評分項目</th>
                      <th className="py-1 text-right text-xs font-normal">
                        配分比例
                      </th>
                      <th className="py-1 text-left text-xs font-normal">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.gradingPolicy.map((g, i) => (
                      <tr key={i} className="border-b border-[color:var(--color-border)]/40">
                        <td className="py-1.5">{g.item ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {g.percent !== null ? `${g.percent}%` : "—"}
                        </td>
                        <td className="py-1.5 text-[color:var(--color-text-dim)]">
                          {g.note ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Missing detail={detail} />
              )}
            </Card>

            <DetailSection
              title="教材 / 參考書目"
              content={detail?.referenceBooks ?? detail?.textbook ?? null}
              missingHint={detail ? "尚未取得詳細資料" : undefined}
            />

            <DetailSection title="Office Hour" content={detail?.officeHour} />
          </section>

          <aside className="space-y-3 text-sm">
            <CourseDetailActions course={course} />

            {detail?.syllabusUrl && (
              <a
                href={detail.syllabusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded border bg-[color:var(--color-surface)] p-3 text-center text-sm hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
              >
                📄 開啟授課大綱（新視窗）
              </a>
            )}

            {detail?.teachers && detail.teachers.length > 0 && (
              <Card title="授課教師">
                <ul className="space-y-1">
                  {detail.teachers.map((t, i) => (
                    <li key={i} className="text-sm">
                      {t.slug ? (
                        <a
                          href={`https://course.thu.edu.tw/view-teacher-profile/${t.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[color:var(--color-accent)]"
                        >
                          {t.name}
                        </a>
                      ) : (
                        t.name
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {detail && detail.fetchStatus !== "success" && (
              <div className="rounded border border-[color:var(--color-warn)]/50 bg-[color:var(--color-warn)]/5 p-3 text-xs text-[color:var(--color-warn)]">
                <div className="font-semibold">
                  詳細頁尚未取得 ({detail.fetchStatus})
                </div>
                {detail.errorMessage && (
                  <div className="mt-1 font-mono text-[10px] opacity-80">
                    {detail.errorMessage}
                  </div>
                )}
              </div>
            )}

            {!detail && (
              <div className="rounded border border-dashed p-3 text-xs text-[color:var(--color-text-dim)]">
                尚未抓取本課的詳細頁。執行：
                <code className="mt-1 block rounded bg-[color:var(--color-surface-2)] p-1.5 text-[10px]">
                  python -m ccsp_importer.cli scrape-details
                  --year {course.year} --semester {course.semester} --course{" "}
                  {course.courseCode}
                </code>
              </div>
            )}

            {detail?.detailUrl && (
              <a
                href={detail.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded border px-3 py-1.5 text-center text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)]"
              >
                查看 THU 原頁面 →
              </a>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-[color:var(--color-surface)] p-4">
      <h2 className="mb-2 text-sm font-semibold tracking-wider text-[color:var(--color-text-dim)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-full" : ""}>
      <dt className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function DetailSection({
  title,
  content,
  missingHint,
}: {
  title: string;
  content: string | null | undefined;
  missingHint?: string;
}) {
  if (!content) {
    return (
      <Card title={title}>
        <p className="text-xs text-[color:var(--color-text-dim)]">
          {missingHint ?? "尚未取得詳細資料"}
        </p>
      </Card>
    );
  }
  return (
    <Card title={title}>
      <p className="whitespace-pre-line text-sm leading-relaxed">{content}</p>
    </Card>
  );
}

function Missing({
  detail,
}: {
  detail: { fetchStatus: string | null } | null;
}) {
  return (
    <p className="text-xs text-[color:var(--color-text-dim)]">
      {detail
        ? `尚未取得詳細資料（status: ${detail.fetchStatus ?? "n/a"}）`
        : "尚未抓取本課的詳細頁"}
    </p>
  );
}
