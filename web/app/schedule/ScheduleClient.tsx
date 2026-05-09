"use client";

import { useMemo, useRef } from "react";
import { findAllConflicts, type CourseLike } from "@/lib/conflict";
import { buildScheduleLayoutBlocks } from "@/lib/scheduleLayout";
import { computeStats } from "@/lib/scheduleStats";
import { useSchedule, type StoredScheduleCourse } from "@/lib/scheduleStore";
import { CopyShareLinkButton } from "@/components/schedule/CopyShareLinkButton";
import { ExportScheduleButton } from "@/components/schedule/ExportScheduleButton";
import { ExportSchedulePdfButton } from "@/components/schedule/ExportSchedulePdfButton";
import { ScheduleSidebar } from "@/components/schedule/ScheduleSidebar";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { ShareImportBanner } from "@/components/schedule/ShareImportBanner";
import { WeeklyGrid } from "@/components/schedule/WeeklyGrid";
import type { Course } from "@/lib/types";

type SharedCourseResult = {
  course: Course;
  status: "planned" | "confirmed";
};

type Props = {
  /** Resolved courses from the ?share= URL param. null = no share param present. */
  sharedCourses?: SharedCourseResult[] | null;
};

export function ScheduleClient({ sharedCourses }: Props) {
  const { courses, mode, hydrated } = useSchedule();
  const gridRef = useRef<HTMLDivElement>(null);

  // ---- term detection ----
  // Collect distinct (year, semester) pairs from the loaded courses
  const termGroups = useMemo(() => {
    const seen = new Map<string, { year: number; semester: number; count: number }>();
    for (const c of courses) {
      const k = `${c.year}-${c.semester}`;
      const existing = seen.get(k);
      if (existing) existing.count++;
      else seen.set(k, { year: c.year, semester: c.semester, count: 1 });
    }
    return [...seen.values()].sort((a, b) =>
      b.year !== a.year ? b.year - a.year : b.semester - a.semester,
    );
  }, [courses]);

  // The "dominant" term is the one with the most courses (or the first by year/semester)
  const dominantTerm = termGroups[0] ?? null;
  const hasMixedTerms = termGroups.length > 1;

  // Build export filename from dominant term
  const termSlug = dominantTerm
    ? `${dominantTerm.year}-${dominantTerm.semester}`
    : "unknown";
  const pngFilename = `ccsp-schedule-${termSlug}.png`;
  const pdfFilename = `ccsp-schedule-${termSlug}.pdf`;

  // Reference-link CourseLike adapters back to their persisted entry so
  // ConflictList can show rich info; conflict.ts compares by reference.
  const { courseLikes, linkBack } = useMemo(() => {
    const link = new WeakMap<CourseLike, StoredScheduleCourse>();
    const likes = courses.map((c) => {
      const like: CourseLike = {
        courseCode: c.courseCode,
        courseName: c.snapshot.courseName,
        credits: c.snapshot.credits ?? undefined,
        timeSlots: c.snapshot.timeSlots,
      };
      link.set(like, c);
      return like;
    });
    return { courseLikes: likes, linkBack: link };
  }, [courses]);

  const conflicts = useMemo(() => findAllConflicts(courseLikes), [courseLikes]);

  // Cell-level conflict highlight set, e.g. "2-4". Drives the grid's
  // background tint independently of any individual block.
  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      for (const cell of c.overlaps) set.add(`${cell.weekday}-${cell.period}`);
    }
    return set;
  }, [conflicts]);

  // The display layout — already merged into row-spanning blocks.
  const blocks = useMemo(
    () => buildScheduleLayoutBlocks(courses, conflicts, mode),
    [courses, conflicts, mode],
  );

  // Courses with no time slots — shown in the 未排定時間 grid column.
  const noTimeCourses = useMemo(
    () => courses.filter((c) => c.snapshot.timeSlots.length === 0),
    [courses],
  );

  const stats = useMemo(
    () =>
      computeStats(
        courses.map((c) => ({
          status: c.status,
          credits: c.snapshot.credits,
          timeSlots: c.snapshot.timeSlots,
        })),
      ),
    [courses],
  );

  if (!hydrated) {
    return (
      <p className="text-sm text-[color:var(--color-text-dim)]">
        正在載入本地課表…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sharedCourses != null && (
        <ShareImportBanner sharedCourses={sharedCourses} />
      )}
      {hasMixedTerms && (
        <div className="rounded-md border border-[color:var(--color-warn,#b45309)] bg-[color:var(--color-warn-bg,#451a03)] px-4 py-2.5 text-sm text-[color:var(--color-warn,#b45309)]">
          目前課表包含不同學期的課程（
          {termGroups.map((t) => `${t.year}-${t.semester}`).join("、")}
          ），請檢查是否混用了舊資料。
        </div>
      )}
      <ScheduleToolbar
        mode={mode}
        stats={stats}
        conflictPairs={conflicts.length}
        termLabel={dominantTerm ? `${dominantTerm.year} 學年度第 ${dominantTerm.semester} 學期` : undefined}
        exportButton={
          <>
            <CopyShareLinkButton />
            <ExportScheduleButton targetRef={gridRef} filename={pngFilename} />
            <ExportSchedulePdfButton targetRef={gridRef} filename={pdfFilename} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto">
          <div ref={gridRef}>
            <WeeklyGrid blocks={blocks} conflictKeys={conflictKeys} mode={mode} noTimeCourses={noTimeCourses} />
          </div>
        </div>
        <ScheduleSidebar
          courses={courses}
          conflicts={conflicts}
          linkBack={linkBack}
          stats={stats}
          mode={mode}
        />
      </div>
    </div>
  );
}
