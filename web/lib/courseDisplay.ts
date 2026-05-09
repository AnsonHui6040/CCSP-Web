/**
 * UI display-layer utilities for course names.
 *
 * NEVER modifies the DB. Only used at render time to produce a clean
 * display string. The full original name is always preserved for tooltips.
 *
 * Cleaning rules (applied in order):
 *  1. Mojibake (U+FFFD, "▲") — truncate at the preceding "(" or at "▲".
 *  2. Long restriction bracket — if name ends with "(…)" whose inner
 *     content is > 12 chars AND contains a restriction keyword, strip bracket.
 *  3. Anything else — return unchanged.
 */

const MOJIBAKE_CHAR = "\uFFFD";

/**
 * Keywords that indicate a trailing bracket is a restriction note, not
 * part of the course name proper.
 */
const RESTRICTION_KEYWORDS: readonly string[] = [
  "不開放",
  "網路選課",
  "先修",
  "限修",
  "管理學",
  "行銷管理",
  "擋修",
  "不得",
];

/**
 * Returns a cleaned course name suitable for display.
 * The original string is left intact for tooltip / aria use.
 */
export function getCourseDisplayName(courseName: string): string {
  if (!courseName) return courseName;

  // --- Rule 1: mojibake truncation ---
  const mIdx = courseName.indexOf(MOJIBAKE_CHAR);
  if (mIdx >= 0) {
    // Look back for an opening paren immediately before the mojibake.
    let truncAt = mIdx;
    const parenBefore = courseName.lastIndexOf("(", mIdx - 1);
    const fullWidthParenBefore = courseName.lastIndexOf("（", mIdx - 1);
    const best = Math.max(parenBefore, fullWidthParenBefore);
    if (best >= 0) truncAt = best;
    return courseName.slice(0, truncAt).trimEnd();
  }

  // --- Rule 2: long restriction bracket ---
  // Matches an optional trailing bracket in half-width ( ) or full-width （ ）.
  const halfWidth = /^([\s\S]*?)(\([^)]+\))\s*$/.exec(courseName);
  const fullWidth = !halfWidth
    ? /^([\s\S]*?)（([^）]+)）\s*$/.exec(courseName)
    : null;

  const bracketMatch = halfWidth ?? fullWidth;
  if (bracketMatch) {
    const base = bracketMatch[1];
    // For half-width the inner text is group 2 (without parens); for full-
    // width we captured the inner text directly as group 2 as well.
    const inner = halfWidth
      ? bracketMatch[2].slice(1, -1)  // strip ( )
      : bracketMatch[2];              // already without （ ）

    if (
      inner.length > 12 &&
      RESTRICTION_KEYWORDS.some((k) => inner.includes(k))
    ) {
      return base.trimEnd();
    }
  }

  return courseName;
}
