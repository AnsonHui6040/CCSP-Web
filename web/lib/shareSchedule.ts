/**
 * URL-based schedule sharing utilities.
 *
 * Encodes the minimal set of course keys (year, semester, courseCode, status)
 * into a base64url string suitable for use as a URL query parameter.
 *
 * No DOM APIs are used except inside buildShareUrl (which receives `origin`
 * as a plain string). No React, no localStorage, no fetch.
 */

import type { ScheduleState } from "./scheduleStore";

// ---------------------------------------------------------------------------
// Types

export type SharedCourseEntry = {
  /** year, e.g. 114 */
  y: number;
  /** semester, 1 or 2 */
  s: number;
  /** courseCode, e.g. "0001" */
  c: string;
  /** status */
  st: "planned" | "confirmed";
};

export type SharedScheduleV1 = {
  v: 1;
  courses: SharedCourseEntry[];
};

// ---------------------------------------------------------------------------
// Validation / normalisation

/** Validate an unknown value against the SharedScheduleV1 shape.
 *  Returns null on any structural mismatch so callers never need to try/catch. */
export function normalizeSharedSchedule(
  input: unknown,
): SharedScheduleV1 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (o["v"] !== 1) return null;
  if (!Array.isArray(o["courses"])) return null;

  const courses: SharedCourseEntry[] = [];
  for (const item of o["courses"]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const e = item as Record<string, unknown>;
    if (typeof e["y"] !== "number") return null;
    if (typeof e["s"] !== "number") return null;
    if (typeof e["c"] !== "string") return null;
    if (e["st"] !== "planned" && e["st"] !== "confirmed") return null;
    courses.push({
      y: e["y"] as number,
      s: e["s"] as number,
      c: e["c"] as string,
      st: e["st"] as "planned" | "confirmed",
    });
  }

  return { v: 1, courses };
}

// ---------------------------------------------------------------------------
// Encode / decode

/**
 * Serialise a ScheduleState into a base64url string.
 * Only the minimum key fields (y, s, c, st) are included — no snapshots.
 *
 * Works in both Node.js 18+ (global `btoa`) and browsers.
 */
export function encodeSharedSchedule(state: ScheduleState): string {
  const payload: SharedScheduleV1 = {
    v: 1,
    courses: state.courses.map((c) => ({
      y: c.year,
      s: c.semester,
      c: c.courseCode,
      st: c.status,
    })),
  };
  const json = JSON.stringify(payload);
  // base64url: replace + → -, / → _, strip trailing =
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode a base64url string back into SharedScheduleV1.
 * Returns null on any decoding or validation failure — never throws.
 */
export function decodeSharedSchedule(
  encoded: string,
): SharedScheduleV1 | null {
  try {
    // base64url → base64
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const parsed: unknown = JSON.parse(json);
    return normalizeSharedSchedule(parsed);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL builder

/**
 * Build a shareable `/schedule?share=<encoded>` URL.
 *
 * @param state  Current schedule state.
 * @param origin Root origin, e.g. `window.location.origin` or `"http://localhost:3000"`.
 */
export function buildShareUrl(state: ScheduleState, origin: string): string {
  const encoded = encodeSharedSchedule(state);
  return `${origin}/schedule?share=${encoded}`;
}
