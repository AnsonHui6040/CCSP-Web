/**
 * detailFreshness.ts
 *
 * Pure helper for computing display state of a course's detail data.
 * Does NOT trigger any fetching — only derives UI state from the stored
 * fetched_at timestamp.
 */

export type DetailFreshness = {
  hasDetails: boolean;
  fetchedAt: string | null;
  /** Fractional days since fetchedAt, or null when fetchedAt is absent/invalid. */
  ageDays: number | null;
  isOlderThan3Days: boolean;
  label: string;
};

const STALE_THRESHOLD_DAYS = 3;

/**
 * Derive freshness state from an ISO-8601 `fetchedAt` string.
 *
 * @param fetchedAt  Value from `course_details.fetched_at` (may be null).
 * @param now        Override current time (for testing).
 */
export function getDetailFreshness(
  fetchedAt: string | null,
  now: Date = new Date(),
): DetailFreshness {
  // ── No data yet ─────────────────────────────────────────────────────────
  if (fetchedAt === null || fetchedAt === "") {
    return {
      hasDetails: false,
      fetchedAt: null,
      ageDays: null,
      isOlderThan3Days: true,
      label: "尚未取得詳細資料",
    };
  }

  // ── Parse the timestamp ──────────────────────────────────────────────────
  const fetched = new Date(fetchedAt);
  if (isNaN(fetched.getTime())) {
    return {
      hasDetails: true,
      fetchedAt,
      ageDays: null,
      isOlderThan3Days: true,
      label: "詳細資料更新時間異常",
    };
  }

  const ageDays = (now.getTime() - fetched.getTime()) / (1000 * 60 * 60 * 24);
  const isOlderThan3Days = ageDays > STALE_THRESHOLD_DAYS;

  // Format as "YYYY-MM-DD HH:mm" in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = fetched.getFullYear();
  const mo = pad(fetched.getMonth() + 1);
  const d = pad(fetched.getDate());
  const h = pad(fetched.getHours());
  const mi = pad(fetched.getMinutes());
  const timeStr = `${y}-${mo}-${d} ${h}:${mi}`;

  if (isOlderThan3Days) {
    return {
      hasDetails: true,
      fetchedAt,
      ageDays,
      isOlderThan3Days: true,
      label: "詳細資料已超過 3 日，可能不是最新",
    };
  }

  return {
    hasDetails: true,
    fetchedAt,
    ageDays,
    isOlderThan3Days: false,
    label: `詳細資料更新於：${timeStr}`,
  };
}
