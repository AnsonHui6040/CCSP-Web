/**
 * courseLinks.ts
 * URL helpers for course-related pages. Centralise all href construction
 * so changes to routing only need to happen here.
 */

export function courseDetailHref(course: {
  year: number;
  semester: number;
  courseCode: string;
}): string {
  return `/courses/${course.year}/${course.semester}/${encodeURIComponent(course.courseCode)}`;
}
