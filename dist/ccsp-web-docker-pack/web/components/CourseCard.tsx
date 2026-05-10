import Link from "next/link";
import type { Course } from "@/lib/types";
import {
  formatCredits,
  formatTeachers,
  formatTimeSlots,
  remainingTier,
} from "@/lib/format";
import { TAG_DEFS_BY_KEY, sortTagKeys } from "@/lib/tags";
import { CandidateButton } from "./CandidateButton";

type Props = { course: Course };

const TIER_CLASS: Record<ReturnType<typeof remainingTier>, string> = {
  ok: "text-[color:var(--color-ok)]",
  warn: "text-[color:var(--color-warn)]",
  danger: "text-[color:var(--color-danger)]",
  unknown: "text-[color:var(--color-text-dim)]",
};

const TAG_LEVEL_CLASS: Record<"high" | "medium" | "low", string> = {
  high: "border-[color:var(--color-danger)]/60 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
  medium:
    "border-[color:var(--color-warn)]/50 bg-[color:var(--color-warn)]/10 text-[color:var(--color-warn)]",
  low: "border bg-[color:var(--color-surface-2)] text-[color:var(--color-text-dim)]",
};

export function CourseCard({ course }: Props) {
  const tier = remainingTier(course);
  const sortedTags = sortTagKeys(course.tags);
  const restrictionRules = course.rules.filter((r) => r.type === "restriction");
  return (
    <article
      data-course-code={course.courseCode}
      className="rounded-lg border bg-[color:var(--color-surface)] p-4 transition hover:border-[color:var(--color-text-dim)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xs text-[color:var(--color-text-dim)]">
              {course.courseCode}
            </span>
            {course.requiredOrElective && (
              <Badge tone="neutral">{course.requiredOrElective}</Badge>
            )}
            {course.deptName && (
              <Badge tone="muted">{course.deptName}</Badge>
            )}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-tight">
            {course.courseName}
          </h3>
          {course.courseNameEn && (
            <div className="text-xs text-[color:var(--color-text-dim)]">
              {course.courseNameEn}
            </div>
          )}
        </div>
        <CandidateButton course={course} />
      </div>

      {sortedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortedTags.map((key) => {
            const def = TAG_DEFS_BY_KEY[key];
            if (!def) return null;
            const restrictionTip =
              key === "restricted" && restrictionRules.length
                ? restrictionRules.map((r) => r.value).join("、")
                : undefined;
            return (
              <span
                key={key}
                title={restrictionTip ?? def.display}
                className={`rounded px-1.5 py-0.5 text-[11px] ${TAG_LEVEL_CLASS[def.level]}`}
              >
                {def.display}
              </span>
            );
          })}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        <Field label="教師">{formatTeachers(course)}</Field>
        <Field label="時間地點">{formatTimeSlots(course.timeSlots)}</Field>
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
      </dl>

      {course.rawNote && (
        <p className="mt-3 whitespace-pre-line rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-2 text-xs text-[color:var(--color-text-dim)]">
          {course.rawNote}
        </p>
      )}

      <div className="mt-3 text-right">
        <Link
          href={`/courses/${course.year}/${course.semester}/${course.courseCode}`}
          className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)]"
        >
          查看詳情 →
        </Link>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
        {label}
      </dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "muted";
}) {
  const cls =
    tone === "neutral"
      ? "border bg-[color:var(--color-surface-2)]"
      : "border bg-transparent text-[color:var(--color-text-dim)]";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{children}</span>
  );
}
