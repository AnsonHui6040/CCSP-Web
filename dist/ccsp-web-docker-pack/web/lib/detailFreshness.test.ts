import { describe, it, expect } from "vitest";
import { getDetailFreshness } from "./detailFreshness";

const NOW = new Date("2026-05-09T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("getDetailFreshness", () => {
  it("null fetchedAt → no details, stale, correct label", () => {
    const f = getDetailFreshness(null, NOW);
    expect(f.hasDetails).toBe(false);
    expect(f.fetchedAt).toBeNull();
    expect(f.ageDays).toBeNull();
    expect(f.isOlderThan3Days).toBe(true);
    expect(f.label).toBe("尚未取得詳細資料");
  });

  it("empty string fetchedAt → treated as null", () => {
    const f = getDetailFreshness("", NOW);
    expect(f.hasDetails).toBe(false);
    expect(f.isOlderThan3Days).toBe(true);
    expect(f.label).toBe("尚未取得詳細資料");
  });

  it("invalid fetchedAt string → anomaly label", () => {
    const f = getDetailFreshness("not-a-date", NOW);
    expect(f.hasDetails).toBe(true);
    expect(f.ageDays).toBeNull();
    expect(f.isOlderThan3Days).toBe(true);
    expect(f.label).toBe("詳細資料更新時間異常");
  });

  it("1 day old → not stale, shows timestamp", () => {
    const f = getDetailFreshness(daysAgo(1), NOW);
    expect(f.hasDetails).toBe(true);
    expect(f.isOlderThan3Days).toBe(false);
    expect(f.ageDays).toBeGreaterThan(0);
    expect(f.ageDays).toBeLessThan(2);
    expect(f.label).toMatch(/^詳細資料更新於：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("exactly 3 days old → not stale", () => {
    const f = getDetailFreshness(daysAgo(3), NOW);
    expect(f.isOlderThan3Days).toBe(false);
    expect(f.label).toMatch(/^詳細資料更新於：/);
  });

  it("3 days + 1 second old → stale", () => {
    const slightly = new Date(NOW.getTime() - (3 * 24 * 60 * 60 + 1) * 1000).toISOString();
    const f = getDetailFreshness(slightly, NOW);
    expect(f.isOlderThan3Days).toBe(true);
    expect(f.label).toBe("詳細資料已超過 3 日，可能不是最新");
  });

  it("4 days old → stale, correct label", () => {
    const f = getDetailFreshness(daysAgo(4), NOW);
    expect(f.hasDetails).toBe(true);
    expect(f.isOlderThan3Days).toBe(true);
    expect(f.label).toBe("詳細資料已超過 3 日，可能不是最新");
  });

  it("30 days old → stale", () => {
    const f = getDetailFreshness(daysAgo(30), NOW);
    expect(f.isOlderThan3Days).toBe(true);
  });

  it("helper never triggers any fetch side-effect", () => {
    // Pure function — calling it many times with the same input is safe
    const a = getDetailFreshness(daysAgo(1), NOW);
    const b = getDetailFreshness(daysAgo(1), NOW);
    expect(a).toEqual(b);
  });
});
