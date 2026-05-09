"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { findCourseConflicts, type CourseLike } from "./conflict";
import { keyMatches, snapshotFromCourse, snapshotKey } from "./courseSnapshot";
import type { Course, StoredCourseSnapshot } from "./types";

const STORAGE_KEY = "ccsp.schedule.v1";

// ---------------------------------------------------------------------------
// Persisted shapes

export type ScheduleMode = "planning" | "official";
export type ScheduleCourseStatus = "planned" | "confirmed";

export type StoredScheduleCourse = {
  courseCode: string;
  year: number;
  semester: number;
  status: ScheduleCourseStatus;
  colorTag?: string;
  addedAt: string;
  updatedAt: string;
  /** Hydrated snapshot of the course at add-time. Avoids needing the DB on the client. */
  snapshot: StoredCourseSnapshot;
};

export type ScheduleState = {
  version: 1;
  mode: ScheduleMode;
  courses: StoredScheduleCourse[];
};

const EMPTY_STATE: ScheduleState = {
  version: 1,
  mode: "planning",
  courses: [],
};

// ---------------------------------------------------------------------------
// Mode-aware confirm result

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "conflict";
      conflictsWith: StoredScheduleCourse[];
    };

// ---------------------------------------------------------------------------
// External store

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: ScheduleState | null = null;

function readState(): ScheduleState {
  if (typeof window === "undefined") return EMPTY_STATE;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = EMPTY_STATE;
      return cache;
    }
    const parsed = JSON.parse(raw) as ScheduleState;
    cache = normalizeState(parsed);
  } catch {
    cache = EMPTY_STATE;
  }
  return cache;
}

function writeState(next: ScheduleState) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function normalizeState(s: ScheduleState | null | undefined): ScheduleState {
  if (!s || typeof s !== "object") return EMPTY_STATE;
  return {
    version: 1,
    mode: s.mode === "official" ? "official" : "planning",
    courses: Array.isArray(s.courses) ? s.courses : [],
  };
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return readState();
}
function getServerSnapshot() {
  return EMPTY_STATE;
}

// ---------------------------------------------------------------------------
// Imperative API (pure functions; safe to call from event handlers)

type Key = { courseCode: string; year: number; semester: number };

export function getScheduleSnapshot(): ScheduleState {
  return readState();
}

export function subscribeSchedule(l: Listener): () => void {
  return subscribe(l);
}

export function isCourseInSchedule(k: Key): boolean {
  return readState().courses.some((c) => keyMatches(c, k));
}

export function addCourseToSchedule(course: Course): void {
  const state = readState();
  const k = snapshotKey(course);
  if (state.courses.some((c) => snapshotKey(c) === k)) return; // dedupe
  const now = new Date().toISOString();
  const entry: StoredScheduleCourse = {
    courseCode: course.courseCode,
    year: course.year,
    semester: course.semester,
    status: "planned",
    addedAt: now,
    updatedAt: now,
    snapshot: snapshotFromCourse(course),
  };
  writeState({ ...state, courses: [...state.courses, entry] });
}

/**
 * Add directly from an existing snapshot (used when the candidate pool is
 * the source — we don't always have the full Course at hand).
 */
export function addSnapshotToSchedule(snapshot: StoredCourseSnapshot): void {
  const state = readState();
  const k = snapshotKey(snapshot);
  if (state.courses.some((c) => snapshotKey(c) === k)) return;
  const now = new Date().toISOString();
  writeState({
    ...state,
    courses: [
      ...state.courses,
      {
        courseCode: snapshot.courseCode,
        year: snapshot.year,
        semester: snapshot.semester,
        status: "planned",
        addedAt: now,
        updatedAt: now,
        snapshot,
      },
    ],
  });
}

export function removeCourseFromSchedule(k: Key): void {
  const state = readState();
  writeState({
    ...state,
    courses: state.courses.filter((c) => !keyMatches(c, k)),
  });
}

/**
 * Promote a course to confirmed.
 *
 * In `planning` mode it always succeeds — exploration shouldn't be
 * blocked. In `official` mode we reject if the course conflicts with
 * any *other* confirmed course.
 *
 * No-time courses (timeSlots: []) never conflict (per conflict.ts), so
 * they can always be confirmed.
 */
export function confirmCourse(k: Key): ConfirmResult {
  const state = readState();
  const target = state.courses.find((c) => keyMatches(c, k));
  if (!target) return { ok: false, reason: "not_found" };

  if (state.mode === "official") {
    const otherConfirmed = state.courses.filter(
      (c) => c.status === "confirmed" && !keyMatches(c, k),
    );
    // Reference-link CourseLike adapters back to their entries so the
    // result is correct even if two confirmed courses happened to share
    // a courseCode (e.g., across terms — currently rare but possible).
    const link = new WeakMap<CourseLike, StoredScheduleCourse>();
    const otherLikes: CourseLike[] = otherConfirmed.map((entry) => {
      const like: CourseLike = scheduleEntryToCourseLike(entry);
      link.set(like, entry);
      return like;
    });
    const targetLike = scheduleEntryToCourseLike(target);
    const clashLikes = findCourseConflicts(targetLike, otherLikes);
    if (clashLikes.length > 0) {
      const conflictsWith = clashLikes
        .map((l) => link.get(l))
        .filter((e): e is StoredScheduleCourse => Boolean(e));
      return { ok: false, reason: "conflict", conflictsWith };
    }
  }

  writeState({
    ...state,
    courses: state.courses.map((c) =>
      keyMatches(c, k)
        ? { ...c, status: "confirmed", updatedAt: new Date().toISOString() }
        : c,
    ),
  });
  return { ok: true };
}

export function unconfirmCourse(k: Key): void {
  const state = readState();
  writeState({
    ...state,
    courses: state.courses.map((c) =>
      keyMatches(c, k)
        ? { ...c, status: "planned", updatedAt: new Date().toISOString() }
        : c,
    ),
  });
}

export function setScheduleMode(mode: ScheduleMode): void {
  const state = readState();
  if (state.mode === mode) return;
  writeState({ ...state, mode });
}

export function clearSchedule(): void {
  writeState({ ...EMPTY_STATE });
}

/** @internal — test-only. */
export function __resetScheduleCacheForTests(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// React hook

export function useSchedule() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Cross-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        cache = null;
        listeners.forEach((l) => l());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    state,
    hydrated,
    courses: state.courses,
    mode: state.mode,
    has: useCallback(
      (k: Key) => state.courses.some((c) => keyMatches(c, k)),
      [state.courses],
    ),
  };
}

/**
 * Replace the entire schedule with courses imported from a share link.
 * Preserves the current mode (planning / official).
 */
export function replaceScheduleFromShared(
  entries: Array<{
    courseCode: string;
    year: number;
    semester: number;
    status: ScheduleCourseStatus;
    snapshot: StoredCourseSnapshot;
  }>,
): void {
  const state = readState();
  const now = new Date().toISOString();
  const courses: StoredScheduleCourse[] = entries.map((e) => ({
    courseCode: e.courseCode,
    year: e.year,
    semester: e.semester,
    status: e.status,
    addedAt: now,
    updatedAt: now,
    snapshot: e.snapshot,
  }));
  writeState({ ...state, courses });
}

// ---------------------------------------------------------------------------
// internals

function scheduleEntryToCourseLike(entry: StoredScheduleCourse) {
  return {
    courseCode: entry.courseCode,
    courseName: entry.snapshot.courseName,
    credits: entry.snapshot.credits ?? undefined,
    timeSlots: entry.snapshot.timeSlots,
  };
}
