"use client";

import { useMemo, useRef } from "react";
import { findAllConflicts, type CourseLike } from "@/lib/conflict";
import { buildScheduleLayoutBlocks } from "@/lib/scheduleLayout";
import { computeStats } from "@/lib/scheduleStats";
import { useSchedule, type StoredScheduleCourse } from "@/lib/scheduleStore";
import { ScheduleSidebar } from "@/components/schedule/ScheduleSidebar";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { WeeklyGrid } from "@/components/schedule/WeeklyGrid";
import { ExportScheduleButton } from "@/components/schedule/ExportScheduleButton";
import { ExportSchedulePdfButton } from "@/components/schedule/ExportSchedulePdfButton";

export function ScheduleClient() {
  const { courses, mode, hydrated } = useSchedule();
  const gridRef = useRef<HTMLDivElement>(null);

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
      <ScheduleToolbar
        mode={mode}
        stats={stats}
        conflictPairs={conflicts.length}
        exportButton={
          <>
            <ExportScheduleButton targetRef={gridRef} filename="ccsp-schedule-114-1.png" />
            <ExportSchedulePdfButton targetRef={gridRef} filename="ccsp-schedule-114-1.pdf" />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div ref={gridRef}>
          <WeeklyGrid blocks={blocks} conflictKeys={conflictKeys} mode={mode} />
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
