import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearScrollPosition,
  readScrollPosition,
  saveScrollPosition,
} from "./scrollRestoration";

// Mock sessionStorage (not available in Node environment)
const store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

beforeEach(() => {
  vi.stubGlobal("sessionStorage", mockStorage);
  mockStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveScrollPosition / readScrollPosition", () => {
  it("saves and reads back scrollTop", () => {
    saveScrollPosition("test-key", 350);
    const result = readScrollPosition("test-key");
    expect(result).not.toBeNull();
    expect(result?.scrollTop).toBe(350);
  });

  it("saves and reads anchorCourseCode", () => {
    saveScrollPosition("test-key", 200, "0042");
    const result = readScrollPosition("test-key");
    expect(result?.anchorCourseCode).toBe("0042");
  });

  it("anchorCourseCode is undefined when not provided", () => {
    saveScrollPosition("test-key", 100);
    const result = readScrollPosition("test-key");
    expect(result?.anchorCourseCode).toBeUndefined();
  });

  it("returns null for missing key", () => {
    expect(readScrollPosition("nonexistent")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    store["ccsp.scroll:bad-key"] = "{not valid json";
    expect(readScrollPosition("bad-key")).toBeNull();
  });

  it("returns null for JSON without numeric scrollTop", () => {
    store["ccsp.scroll:bad-key"] = JSON.stringify({ scrollTop: "not-a-number" });
    expect(readScrollPosition("bad-key")).toBeNull();
  });

  it("returns null for JSON with null value", () => {
    store["ccsp.scroll:null-key"] = JSON.stringify(null);
    expect(readScrollPosition("null-key")).toBeNull();
  });

  it("different keys do not contaminate each other", () => {
    saveScrollPosition("/courses?q=foo", 100);
    saveScrollPosition("/courses?q=bar", 500);
    expect(readScrollPosition("/courses?q=foo")?.scrollTop).toBe(100);
    expect(readScrollPosition("/courses?q=bar")?.scrollTop).toBe(500);
  });

  it("different dept params yield independent positions", () => {
    saveScrollPosition("/courses?dept=100&sem=2&year=114", 200);
    saveScrollPosition("/courses?dept=200&sem=2&year=114", 800);
    expect(
      readScrollPosition("/courses?dept=100&sem=2&year=114")?.scrollTop,
    ).toBe(200);
    expect(
      readScrollPosition("/courses?dept=200&sem=2&year=114")?.scrollTop,
    ).toBe(800);
  });

  it("overwrites existing position with latest value", () => {
    saveScrollPosition("key-a", 100);
    saveScrollPosition("key-a", 999);
    expect(readScrollPosition("key-a")?.scrollTop).toBe(999);
  });
});

describe("clearScrollPosition", () => {
  it("removes the stored entry", () => {
    saveScrollPosition("to-clear", 99, "0007");
    clearScrollPosition("to-clear");
    expect(readScrollPosition("to-clear")).toBeNull();
  });

  it("does not throw for non-existent key", () => {
    expect(() => clearScrollPosition("ghost")).not.toThrow();
  });

  it("only removes the targeted key", () => {
    saveScrollPosition("keep-me", 42);
    saveScrollPosition("remove-me", 0);
    clearScrollPosition("remove-me");
    expect(readScrollPosition("keep-me")?.scrollTop).toBe(42);
    expect(readScrollPosition("remove-me")).toBeNull();
  });
});
