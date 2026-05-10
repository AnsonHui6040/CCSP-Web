/**
 * Tag taxonomy — kept in lock-step with `importer/ccsp_importer/note_parser.py`.
 *
 * Adding a tag here without adding it on the Python side will appear empty
 * in the UI; adding on the Python side without here will fall back to the
 * raw key. The order is the badge-display priority.
 */

export type TagLevel = "low" | "medium" | "high";

export type TagKey =
  | "online_selection_unavailable"
  | "manual_selection_required"
  | "restricted"
  | "not_count_graduation"
  | "not_count_gpa"
  | "placement_test_required"
  | "english_taught"
  | "remote"
  | "micro_credit"
  | "irregular_schedule";

export type TagDef = {
  key: TagKey;
  display: string;
  level: TagLevel;
};

export const TAG_DEFS: ReadonlyArray<TagDef> = [
  { key: "online_selection_unavailable", display: "🔴 不可網選", level: "high" },
  { key: "manual_selection_required", display: "🟠 人工加選", level: "medium" },
  { key: "restricted", display: "🔒 限修", level: "high" },
  { key: "not_count_graduation", display: "⚠️ 不列畢業學分", level: "high" },
  { key: "not_count_gpa", display: "⚠️ 不列 GPA", level: "medium" },
  { key: "placement_test_required", display: "📝 分級測驗", level: "medium" },
  { key: "english_taught", display: "🌐 英文授課", level: "low" },
  { key: "remote", display: "💻 遠距", level: "low" },
  { key: "micro_credit", display: "🧩 微學分", level: "low" },
  { key: "irregular_schedule", display: "🕒 時間另訂", level: "medium" },
];

export const TAG_DEFS_BY_KEY: Readonly<Record<TagKey, TagDef>> = Object.freeze(
  Object.fromEntries(TAG_DEFS.map((t) => [t.key, t])),
) as Readonly<Record<TagKey, TagDef>>;

/** Sort tag keys into display priority. Unknown keys go to the end. */
export function sortTagKeys(keys: readonly string[]): TagKey[] {
  const order = new Map(TAG_DEFS.map((t, i) => [t.key, i]));
  return [...keys]
    .filter((k): k is TagKey => order.has(k as TagKey))
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

export const RISK_COLOR: Record<TagLevel, string> = {
  high: "var(--color-danger)",
  medium: "var(--color-warn)",
  low: "var(--color-text-dim)",
};
