import { describe, expect, it } from "vitest";
import {
  OFFICIAL_PERIODS,
  OFFICIAL_PERIOD_MAP,
  OFFICIAL_LAST_GRID_ROW,
  periodToGridRow,
} from "./periods";

describe("OFFICIAL_PERIODS structure", () => {
  it("has 15 entries (0 through 13 plus 4.5)", () => {
    expect(OFFICIAL_PERIODS).toHaveLength(15);
  });

  it("starts with period 0", () => {
    expect(OFFICIAL_PERIODS[0].key).toBe("0");
    expect(OFFICIAL_PERIODS[0].time).toBe("07:10-08:00");
    expect(OFFICIAL_PERIODS[0].isBreak).toBe(false);
  });

  it("has period 4.5 as a break row", () => {
    const p = OFFICIAL_PERIOD_MAP.get("4.5");
    expect(p).toBeDefined();
    expect(p!.isBreak).toBe(true);
    expect(p!.time).toBe("12:10-13:00");
  });

  it("only 4.5 is marked isBreak", () => {
    const breakPeriods = OFFICIAL_PERIODS.filter((p) => p.isBreak);
    expect(breakPeriods).toHaveLength(1);
    expect(breakPeriods[0].key).toBe("4.5");
  });

  it("ends with period 13", () => {
    expect(OFFICIAL_PERIODS[OFFICIAL_PERIODS.length - 1].key).toBe("13");
  });

  it("does NOT include A or B", () => {
    const keys = OFFICIAL_PERIODS.map((p) => p.key);
    expect(keys).not.toContain("A");
    expect(keys).not.toContain("B");
  });

  it("display order is 0,1,2,3,4,4.5,5,6,7,8,9,10,11,12,13", () => {
    expect(OFFICIAL_PERIODS.map((p) => p.key)).toEqual([
      "0","1","2","3","4","4.5","5","6","7","8","9","10","11","12","13",
    ]);
  });
});

describe("OFFICIAL_PERIOD_MAP", () => {
  it("maps all 15 keys", () => {
    expect(OFFICIAL_PERIOD_MAP.size).toBe(15);
  });

  it("can look up by key string", () => {
    expect(OFFICIAL_PERIOD_MAP.get("5")?.time).toBe("13:10-14:00");
    expect(OFFICIAL_PERIOD_MAP.get("13")?.time).toBe("21:20-22:10");
  });
});

describe("periodToGridRow", () => {
  it("period 0 maps to row 2 (row 1 is header)", () => {
    expect(periodToGridRow("0")).toBe(2);
  });

  it("period 1 maps to row 3", () => {
    expect(periodToGridRow("1")).toBe(3);
  });

  it("period 4.5 maps to row 7 (between 4→6 and 5→8)", () => {
    expect(periodToGridRow("4")).toBe(6);
    expect(periodToGridRow("4.5")).toBe(7);
    expect(periodToGridRow("5")).toBe(8);
  });

  it("period 13 maps to OFFICIAL_LAST_GRID_ROW (16)", () => {
    expect(periodToGridRow("13")).toBe(OFFICIAL_LAST_GRID_ROW);
    expect(OFFICIAL_LAST_GRID_ROW).toBe(16);
  });

  it("A and B return -1 when hasAB=false", () => {
    expect(periodToGridRow("A", false)).toBe(-1);
    expect(periodToGridRow("B", false)).toBe(-1);
  });

  it("A maps to row 17 and B to row 18 when hasAB=true", () => {
    expect(periodToGridRow("A", true)).toBe(17);
    expect(periodToGridRow("B", true)).toBe(18);
  });

  it("unknown period returns -1", () => {
    expect(periodToGridRow("Z")).toBe(-1);
    expect(periodToGridRow("")).toBe(-1);
    expect(periodToGridRow("99")).toBe(-1);
  });

  it("span from period 2 to period 4 covers 3 grid rows (no gap)", () => {
    const start = periodToGridRow("2");
    const end = periodToGridRow("4");
    expect(end - start + 1).toBe(3);
  });

  it("span from period 4 to period 5 covers 3 grid rows (includes 4.5 break)", () => {
    const start = periodToGridRow("4");
    const end = periodToGridRow("5");
    // 4→row6, 4.5→row7, 5→row8  →  span = 8-6+1 = 3
    expect(end - start + 1).toBe(3);
  });
});
