"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CandidateEntry, Course, StoredCourseSnapshot } from "@/lib/types";
import { keyMatches, snapshotFromCourse, snapshotKey } from "@/lib/courseSnapshot";

const STORAGE_KEY = "ccsp.candidates.v2";

// ---------------------------------------------------------------------------
// External store wired into useSyncExternalStore so multiple components
// (cards + pool panel + schedule sidebar) stay in sync without a Context.

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: Map<string, CandidateEntry> | null = null;

function readStorage(): Map<string, CandidateEntry> {
  if (typeof window === "undefined") return new Map();
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr: CandidateEntry[] = raw ? JSON.parse(raw) : [];
    cache = new Map(arr.map((e) => [snapshotKey(e), e]));
  } catch {
    cache = new Map();
  }
  return cache;
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
function getServerSnapshot() {
  return new Map<string, CandidateEntry>();
}

// ---------------------------------------------------------------------------
// Hook

type Key = { courseCode: string; year: number; semester: number };

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

  const has = useCallback(
    (k: Key) => map.has(snapshotKey(k)),
    [map],
  );

  const add = useCallback((course: Course) => {
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
  }, []);

  const remove = useCallback((k: Key) => {
    const next = new Map(readStorage());
    next.delete(snapshotKey(k));
    writeStorage(next);
  }, []);

  const toggle = useCallback(
    (course: Course) => {
      const k = snapshotKey(course);
      const next = new Map(readStorage());
      if (next.has(k)) {
        next.delete(k);
      } else {
        const entry: CandidateEntry = {
          year: course.year,
          semester: course.semester,
          courseCode: course.courseCode,
          addedAt: new Date().toISOString(),
          snapshot: snapshotFromCourse(course),
        };
        next.set(k, entry);
      }
      writeStorage(next);
    },
    [],
  );

  const clear = useCallback(() => writeStorage(new Map()), []);

  return {
    entries: Array.from(map.values()),
    snapshots: Array.from(map.values()).map((e) => e.snapshot),
    has,
    add,
    remove,
    toggle,
    clear,
    hydrated,
  };
}

export type { Key as CandidateKey };
export { keyMatches };
export type { StoredCourseSnapshot };
