"use client";

import { useMemo } from "react";
import { findAllConflicts, getOccupiedSlots } from "@/lib/conflict";
import { computeStats } from "@/lib/scheduleStats";
import { useSchedule } from "@/lib/scheduleStore";
import { ScheduleSidebar } from "@/components/schedule/ScheduleSidebar";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { WeeklyGrid } from "@/components/schedule/WeeklyGrid";

export function ScheduleClient() {
  const { courses, mode, hydrated } = useSchedule();

  // Adapt the persisted entries to the structural CourseLike shape that
  // conflict.ts expects.
  const courseLikes = useMemo(
    () =>
      courses.map((c) => ({
        courseCode: c.courseCode,
        courseName: c.snapshot.courseName,
        credits: c.snapshot.credits ?? undefined,
        timeSlots: c.snapshot.timeSlots,
        // Deliberately NOT setting `id` — the schedule entries don't have
        // a numeric id; identity inside conflict.ts falls back to
        // reference equality, which matches our use here.
      })),
    [courses],
  );

  const conflicts = useMemo(() => findAllConflicts(courseLikes), [courseLikes]);
  const occupied = useMemo(() => getOccupiedSlots(courseLikes), [courseLikes]);

  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      for (const cell of c.overlaps) {
        set.add(`${cell.weekday}-${cell.period}`);
      }
    }
    return set;
  }, [conflicts]);

  // Re-key conflicts back to the persisted entries so downstream UI gets
  // the rich `StoredScheduleCourse` (with status / snapshot).
  const conflictsForUi = useMemo(() => {
    return conflicts.map((c) => {
      const a = courses.find((e) => e.courseCode === c.a.courseCode)!;
      const b = courses.find((e) => e.courseCode === c.b.courseCode)!;
      return {
        a: { ...c.a, snapshot: a.snapshot } as unknown as typeof c.a & {
          snapshot: typeof a.snapshot;
        },
        b: { ...c.b, snapshot: b.snapshot } as unknown as typeof c.b & {
          snapshot: typeof b.snapshot;
        },
        overlaps: c.overlaps,
      };
    });
  }, [conflicts, courses]);

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
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <WeeklyGrid
          courses={courses}
          occupied={occupied}
          conflictKeys={conflictKeys}
          mode={mode}
        />
        <ScheduleSidebar
          courses={courses}
          conflicts={conflictsForUi as unknown as typeof conflicts}
          stats={stats}
          mode={mode}
        />
      </div>
    </div>
  );
}
