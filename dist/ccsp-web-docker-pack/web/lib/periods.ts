/**
 * Official period (節次) definitions for 東海大學 CCSP.
 *
 * Matches the official timetable layout exactly:
 *   0 07:10-08:00
 *   1 08:10-09:00
 *   ...
 *   4 11:20-12:10
 *   4.5 12:10-13:00  ← lunch break (isBreak=true, display-only)
 *   5 13:10-14:00
 *   ...
 *   13 21:20-22:10
 *
 * Key design decisions:
 * - "4.5" is a display-only break row; no course should occupy it.
 * - "A" and "B" are NOT in OFFICIAL_PERIODS; they are shown conditionally
 *   at the bottom of WeeklyGrid only when schedule data actually contains them.
 * - periodToGridRow() maps any period key to its CSS grid row index.
 */

export type OfficialPeriodKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "4.5"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13";

export type OfficialPeriod = {
  key: OfficialPeriodKey;
  label: string;
  time: string;
  /** True only for the 4.5 lunch-break row. Styled differently; no course occupies it. */
  isBreak: boolean;
};

export const OFFICIAL_PERIODS: OfficialPeriod[] = [
  { key: "0",   label: "0",   time: "07:10-08:00", isBreak: false },
  { key: "1",   label: "1",   time: "08:10-09:00", isBreak: false },
  { key: "2",   label: "2",   time: "09:10-10:00", isBreak: false },
  { key: "3",   label: "3",   time: "10:20-11:10", isBreak: false },
  { key: "4",   label: "4",   time: "11:20-12:10", isBreak: false },
  { key: "4.5", label: "4.5", time: "12:10-13:00", isBreak: true  },
  { key: "5",   label: "5",   time: "13:10-14:00", isBreak: false },
  { key: "6",   label: "6",   time: "14:10-15:00", isBreak: false },
  { key: "7",   label: "7",   time: "15:20-16:10", isBreak: false },
  { key: "8",   label: "8",   time: "16:20-17:10", isBreak: false },
  { key: "9",   label: "9",   time: "17:20-18:10", isBreak: false },
  { key: "10",  label: "10",  time: "18:20-19:10", isBreak: false },
  { key: "11",  label: "11",  time: "19:20-20:10", isBreak: false },
  { key: "12",  label: "12",  time: "20:20-21:10", isBreak: false },
  { key: "13",  label: "13",  time: "21:20-22:10", isBreak: false },
];

/**
 * Lookup map for quick access by key.
 */
export const OFFICIAL_PERIOD_MAP = new Map<string, OfficialPeriod>(
  OFFICIAL_PERIODS.map((p) => [p.key, p]),
);

// ---------------------------------------------------------------------------
// Grid-row mapping
//
// CSS grid rows (1-based):
//   Row 1 : header
//   Row 2 : period "0"
//   Row 3 : period "1"
//   ...
//   Row 6 : period "4"
//   Row 7 : period "4.5"  (break, smaller height)
//   Row 8 : period "5"
//   ...
//   Row 16: period "13"
//   Row 17: period "A"  (only when hasAB=true)
//   Row 18: period "B"  (only when hasAB=true)

const _PERIOD_TO_GRID_ROW = new Map<string, number>(
  OFFICIAL_PERIODS.map((p, i) => [p.key, i + 2]),
);

/** Grid row for the last official period ("13"). A/B are placed after this. */
export const OFFICIAL_LAST_GRID_ROW = OFFICIAL_PERIODS.length + 1; // = 16

/**
 * Returns the CSS grid row (1-based) for a given period key.
 * Returns -1 for unknown / unsupported keys.
 *
 * @param periodKey  e.g. "0", "4.5", "7", "A"
 * @param hasAB      true if the grid is currently showing A/B rows
 */
export function periodToGridRow(periodKey: string, hasAB = false): number {
  const official = _PERIOD_TO_GRID_ROW.get(periodKey);
  if (official !== undefined) return official;
  if (periodKey === "A") return hasAB ? OFFICIAL_LAST_GRID_ROW + 1 : -1;
  if (periodKey === "B") return hasAB ? OFFICIAL_LAST_GRID_ROW + 2 : -1;
  return -1;
}
