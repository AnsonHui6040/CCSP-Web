"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CandidateEntry, Course, StoredCourseSnapshot } from "@/lib/types";
import { keyMatches, snapshotFromCourse, snapshotKey } from "@/lib/courseSnapshot";

const STORAGE_KEY = "ccsp.candidates.v2";

// ---------------------------------------------------------------------------
// External store (module-level cache + listener set)

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: Map<string, CandidateEntry> | null = null;

function readStorage(): Map<string, CandidateEntry> {
  if (typeof window === "undefined") return new Map();
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) {
      cache = new Map();
      return cache;
    }
    cache = new Map(
      arr
        .filter((e): e is CandidateEntry => isPlausibleEntry(e))
        .map((e) => [snapshotKey(e), e]),
    );
  } catch {
    cache = new Map();
  }
  return cache;
}

function isPlausibleEntry(e: unknown): e is CandidateEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.courseCode === "string" &&
    typeof o.year === "number" &&
    typeof o.semester === "number" &&
    typeof o.snapshot === "object" &&
    o.snapshot !== null
  );
}

function writeStorage(next: Map<string, CandidateEntry>) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(next.values())),
    );
  }
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return readStorage();
}

// Stable empty map for SSR — must be the same reference on every call to
// avoid triggering React's "getServerSnapshot should be cached" invariant.
const EMPTY_MAP = new Map<string, CandidateEntry>();

function getServerSnapshot() {
  return EMPTY_MAP;
}

// ---------------------------------------------------------------------------
// Imperative API (testable without React)

export type CandidateKey = {
  courseCode: string;
  year: number;
  semester: number;
};

export function getCandidates(): CandidateEntry[] {
  return Array.from(readStorage().values());
}

export function isCandidate(k: CandidateKey): boolean {
  return readStorage().has(snapshotKey(k));
}

export function addCandidate(course: Course): void {
  const next = new Map(readStorage());
  const entry: CandidateEntry = {
    year: course.year,
    semester: course.semester,
    courseCode: course.courseCode,
    addedAt: new Date().toISOString(),
    snapshot: snapshotFromCourse(course),
  };
  next.set(snapshotKey(entry), entry);
  writeStorage(next);
}

export function removeCandidate(k: CandidateKey): void {
  const next = new Map(readStorage());
  next.delete(snapshotKey(k));
  writeStorage(next);
}

export function toggleCandidate(course: Course): void {
  const k = snapshotKey(course);
  const next = new Map(readStorage());
  if (next.has(k)) {
    next.delete(k);
  } else {
    next.set(k, {
      year: course.year,
      semester: course.semester,
      courseCode: course.courseCode,
      addedAt: new Date().toISOString(),
      snapshot: snapshotFromCourse(course),
    });
  }
  writeStorage(next);
}

export function clearCandidates(): void {
  writeStorage(new Map());
}

/** @internal — test-only. */
export function __resetCandidatesCacheForTests(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// React hook

export function useCandidatePool() {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
    entries: Array.from(map.values()),
    snapshots: Array.from(map.values()).map((e) => e.snapshot),
    hydrated,
    has: useCallback((k: CandidateKey) => map.has(snapshotKey(k)), [map]),
    add: useCallback((c: Course) => addCandidate(c), []),
    remove: useCallback((k: CandidateKey) => removeCandidate(k), []),
    toggle: useCallback((c: Course) => toggleCandidate(c), []),
    clear: useCallback(() => clearCandidates(), []),
  };
}

export { keyMatches };
export type { StoredCourseSnapshot };
