"""Parse the free-text 備註 field into structured tags / warnings / rules.

Deterministic, case-insensitive, regex-based. No AI, no external calls.

Public API:
    parse_note(raw_note: str | None) -> dict

Returned shape::

    {
      "tags":         [str, ...],            # stable keys
      "warnings":     [{type, level, message}, ...],
      "rules":        [{type, value, source}, ...],
      "risk_level":   "low" | "medium" | "high",
    }

`raw_note` is never modified. Add a new tag by extending TAG_DEFS — the
order there is also the badge-display priority used by the web UI.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Tag taxonomy
# ---------------------------------------------------------------------------

# Levels are aligned with the spec:
#   high   -> hard blockers / unexpected outcomes (no online enrol, won't
#             count for graduation, restriction on who may take)
#   medium -> meaningful procedural friction (manual enrol, placement test,
#             irregular schedule, no GPA contribution)
#   low    -> informational tags that the user might filter on but rarely
#             cause harm (English-taught, remote, micro-credit)
LEVEL_HIGH = "high"
LEVEL_MEDIUM = "medium"
LEVEL_LOW = "low"


@dataclass(frozen=True)
class TagDef:
    key: str
    display: str        # short badge text incl. emoji
    level: str          # high / medium / low
    keywords: tuple[str, ...]   # regex patterns, case-insensitive


# Order = badge priority (most-important first). The web UI mirrors this.
TAG_DEFS: tuple[TagDef, ...] = (
    TagDef(
        key="online_selection_unavailable",
        display="🔴 不可網選",
        level=LEVEL_HIGH,
        keywords=(
            r"不開放網路選課",
            r"不開放線上選課",
            r"不開放網選",
            r"不得網路選課",
        ),
    ),
    TagDef(
        key="manual_selection_required",
        display="🟠 人工加選",
        level=LEVEL_MEDIUM,
        keywords=(
            # IMPORTANT: 「不開放人工加選」reverses the meaning, so we must
            # NOT match these positive forms inside a negation. Python `re`
            # only supports fixed-width lookbehinds, so we stack one per
            # negation prefix (each different length).
            r"(?<!不開放)(?<!不得)(?<!禁止)人工選課",
            r"(?<!不開放)(?<!不得)(?<!禁止)人工加選",
            r"(?<!不開放)(?<!不得)(?<!禁止)人工登記",
            r"需人工加選",
            r"請洽系辦",
            r"洽系辦",
        ),
    ),
    TagDef(
        key="restricted",
        display="🔒 限修",
        level=LEVEL_HIGH,
        keywords=(
            # 系所 / 班次
            r"限本系",
            r"限本班",
            r"非本系不得修習",
            r"不開放外系",
            # 年級
            r"限大一",
            r"限大二",
            r"限大三",
            r"限大四",
            # 學位階段
            r"限碩士班",
            r"限博士班",
            # 身份
            r"限外國學生",
            r"限僑生",
            r"限交換生",
            # 一般 catch-all (放最後,避免覆蓋更具體的關鍵字)
            r"限修",
        ),
    ),
    TagDef(
        key="not_count_graduation",
        display="⚠️ 不列畢業學分",
        level=LEVEL_HIGH,
        keywords=(
            r"不計入畢業學分",
            r"不列入畢業學分",
            r"不得計入畢業學分",
            r"亦不計入畢業學分",
        ),
    ),
    TagDef(
        key="not_count_gpa",
        display="⚠️ 不列 GPA",
        level=LEVEL_MEDIUM,
        keywords=(
            r"不列入學期學業平均成績",
            r"不計入學期平均",
            r"不列入平均",
            # 「不列入 GPA」/「不計GPA」/「不列 GPA」等變形,允許「入」與空白彈性
            r"不[列計]入?\s*GPA",
        ),
    ),
    TagDef(
        key="placement_test_required",
        display="📝 分級測驗",
        level=LEVEL_MEDIUM,
        keywords=(
            r"分級測驗",
            r"中文能力分級測驗",
            r"英文分級測驗",
            r"依分班上課",
            r"需參加測驗",
        ),
    ),
    TagDef(
        key="english_taught",
        display="🌐 英文授課",
        level=LEVEL_LOW,
        keywords=(
            r"全英授課",
            r"全英文授課",
            r"英語授課",
            r"英文授課",
            r"\bEMI\b",
            r"\bEnglish[\s-]*taught\b",
        ),
    ),
    TagDef(
        key="remote",
        display="💻 遠距",
        level=LEVEL_LOW,
        keywords=(
            r"遠距教學",
            r"遠距課程",
            r"線上課程",
            r"線上授課",
            r"非同步",
            r"同步遠距",
            r"Microsoft\s+Teams",
            r"Google\s+Meet",
            r"Webex",
        ),
    ),
    TagDef(
        key="micro_credit",
        display="🧩 微學分",
        level=LEVEL_LOW,
        keywords=(
            r"微學分",
            r"微學分課程",
        ),
    ),
    TagDef(
        key="irregular_schedule",
        display="🕒 時間另訂",
        level=LEVEL_MEDIUM,
        keywords=(
            r"密集授課",
            r"上課時間另訂",
            # bare "另訂" is intentionally allowed — when paired with a
            # course-time mention it almost always refers to scheduling.
            r"另訂",
            r"時間另行公告",
            # opendata 將「無時間」表為「無資料」, 偶爾出現在 raw_note
            r"無資料",
        ),
    ),
)


TAG_DEFS_BY_KEY: dict[str, TagDef] = {t.key: t for t in TAG_DEFS}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_note(raw_note: Optional[str]) -> dict:
    """Extract tags / warnings / rules / risk_level from a 備註 string.

    Returns the shape documented at the top of this module. Always returns
    a dict, even for empty input.
    """
    text = (raw_note or "").strip()
    if not text:
        return {
            "tags": [],
            "warnings": [],
            "rules": [],
            "risk_level": LEVEL_LOW,
        }

    tags: list[str] = []
    warnings: list[dict] = []
    rules: list[dict] = []

    for tag in TAG_DEFS:
        matches = _find_matches(text, tag.keywords)
        if not matches:
            continue
        if tag.key not in tags:
            tags.append(tag.key)
            warnings.append(
                {
                    "type": tag.key,
                    "level": tag.level,
                    "message": tag.display,
                }
            )
        # Restrictions need rule entries with the actual matched text so
        # the UI can show "限本系", "限大三" etc. verbatim.
        if tag.key == "restricted":
            for phrase in matches:
                if not _has_rule_for(rules, phrase):
                    rules.append(
                        {
                            "type": "restriction",
                            "value": phrase,
                            "source": "raw_note",
                        }
                    )

    risk_level = _compute_risk_level(warnings)
    return {
        "tags": tags,
        "warnings": warnings,
        "rules": rules,
        "risk_level": risk_level,
    }


# ---------------------------------------------------------------------------
# internals
# ---------------------------------------------------------------------------

def _find_matches(text: str, patterns: tuple[str, ...]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            phrase = m.group(0).strip()
            if phrase and phrase not in out:
                out.append(phrase)
    return out


def _has_rule_for(rules: list[dict], value: str) -> bool:
    return any(r["type"] == "restriction" and r["value"] == value for r in rules)


def _compute_risk_level(warnings: list[dict]) -> str:
    levels = {w["level"] for w in warnings}
    if LEVEL_HIGH in levels:
        return LEVEL_HIGH
    if LEVEL_MEDIUM in levels:
        return LEVEL_MEDIUM
    return LEVEL_LOW
