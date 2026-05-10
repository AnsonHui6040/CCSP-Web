import { Navbar } from "@/components/Navbar";
import { getCoursesByKeys } from "@/lib/queries";
import { decodeSharedSchedule } from "@/lib/shareSchedule";
import type { Course } from "@/lib/types";
import { ScheduleClient } from "./ScheduleClient";

type SharedCourseResult = {
  course: Course;
  status: "planned" | "confirmed";
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const shareParam = typeof params["share"] === "string" ? params["share"] : null;

  let sharedCourses: SharedCourseResult[] | null = null;
  if (shareParam) {
    const decoded = decodeSharedSchedule(shareParam);
    if (decoded && decoded.courses.length > 0) {
      sharedCourses = getCoursesByKeys(
        decoded.courses.map((e) => ({
          year: e.y,
          semester: e.s,
          courseCode: e.c,
          status: e.st,
        })),
      );
    } else if (decoded) {
      // valid but empty — still show the banner so user knows it was a share link
      sharedCourses = [];
    }
  }

  return (
    <>
      <Navbar active="schedule" />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <ScheduleClient sharedCourses={sharedCourses} />
      </main>
    </>
  );
}
