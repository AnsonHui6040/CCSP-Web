"use client";

import { useMemo } from "react";
import {
  findAllConflicts,
  getOccupiedSlots,
  type CourseLike,
} from "@/lib/conflict";
import { computeStats } from "@/lib/scheduleStats";
import { useSchedule, type StoredScheduleCourse } from "@/lib/scheduleStore";
import { ScheduleSidebar } from "@/components/schedule/ScheduleSidebar";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { WeeklyGrid } from "@/components/schedule/WeeklyGrid";

export function ScheduleClient() {
  const { courses, mode, hydrated } = useSchedule();

  // Build CourseLike adapters for the conflict layer + a WeakMap that
  // round-trips back to the rich StoredScheduleCourse. Reference-based
  // matching is safer than (year, sem, courseCode) string keys: it
  // works for any future identity shape without risk of collision.
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
          occupied={occupied}
          linkBack={linkBack}
          conflictKeys={conflictKeys}
          mode={mode}
        />
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
