"""Rule-based textbook extractor for THU course details.

Searches ``course_details`` fields for explicit textbook references and
returns the extracted text, or ``None`` when no confident match is found.

Strategy (priority order):
    1. Explicit textbook section key in ``raw_sections_json``
       (e.g. a section literally titled「教材」).
    2. ``reference_books`` text — keyword + colon patterns, standalone
       handout markers, or "no textbook" declarations.
    3. ``teaching_goal`` text — same pattern search.
    4. ``course_description`` text — same pattern search.

The extractor is *conservative*: it never returns the entire
``reference_books`` field when there is no explicit marker.

Usage (programmatic)::

    from ccsp_importer.textbook_extractor import extract_textbook
    result = extract_textbook(detail_dict)

Usage (batch + write-back)::

    python -m ccsp_importer.cli extract-textbooks --year 114 --semester 1
"""
from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any, Optional

from .config import DB_PATH

# ---------------------------------------------------------------------------
# Tuneable constants

_MAX_LEN = 1000  # chars; extractions longer than this are rejected as suspicious
_MIN_LEN = 2     # chars; shorter extractions are treated as noise

# ---------------------------------------------------------------------------
# Keyword lists

# Intro keywords that introduce textbook content when followed by a colon.
# Ordered most-specific → most-generic so the alternation prefers specifics.
_COLON_KEYWORDS: list[str] = [
    "指定教材",
    "主要教材",
    "上課教材",
    "使用教材",
    "課程教材",
    "參考教材",
    "教材",           # bare form — comes last so specifics match first
    "Required Textbook",
    "Required Text",
    "Course Materials",
    "Teaching Materials",
    "Textbook",
    "Materials",
    "Handout",
    "Lecture notes",
]

# Match an intro keyword at the START of a line, followed by a colon.
# MULTILINE makes ^ match at the start of each line.
_LINE_COLON_PAT = re.compile(
    r"^[ \t]*(?:" + "|".join(re.escape(k) for k in _COLON_KEYWORDS) + r")\s*[：:]\s*",
    re.IGNORECASE | re.MULTILINE,
)

# Same pattern but with a capture group for the matched keyword (for stats).
_MATCHED_KEYWORD_PAT = re.compile(
    r"^[ \t]*(" + "|".join(re.escape(k) for k in _COLON_KEYWORDS) + r")\s*[：:]",
    re.IGNORECASE | re.MULTILINE,
)

# Stop keywords — when one of these appears at the start of a line during
# multi-line extraction, stop and discard the rest.
_STOP_KEYWORDS: list[str] = [
    "補充教材",
    "主要參考書",
    "參考書目",
    "參考書籍",
    "參考書",
    "評分方式",
    "教學目標",
    "課程概述",
    "課程大綱",
    "選課備註",
    "授課教師",
    "Teaching Goals",
    "Course Outline",
    "Course Schedule",
    "Grading",
    "Office Hour",
    "Notes",
    "Reference",
]

_STOP_PAT = re.compile(
    r"^[ \t]*(?:"
    r"補充教材|主要參考書|參考書目|參考書籍|參考書|評分方式|教學目標|課程概述|課程大綱|選課備註|授課教師"
    r"|Teaching\s+Goals?"
    r"|Course\s+Outline"
    r"|Course\s+Schedule"
    r"|Grading"
    r"|Office\s+Hour"
    r"|Notes?"
    r"|References?"
    r")[ \t]*(?:[：:]|$)",
    re.IGNORECASE | re.MULTILINE,
)

# "No textbook" declarations → normalize to the canonical string below.
_NO_TEXTBOOK_PAT = re.compile(
    r"(?:無指定教材|無教科書|No\s+textbook(?:\s+required)?|No\s+required\s+text)",
    re.IGNORECASE,
)
_NO_TEXTBOOK = "無指定教材"

# Standalone handout/lecture-note markers (match when they ARE the entire
# trimmed text or the first non-empty line).
_STANDALONE_PAT = re.compile(
    r"(?:(?:教師自編)?(?:自編)?(?:課堂)?講義"
    r"|Handout[s]?"
    r"|Lecture\s+notes"
    r")[。！!]?",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Public API


def extract_textbook(detail: dict) -> Optional[str]:
    """Extract textbook info from a course detail dict.

    Args:
        detail: dict whose keys match ``course_details`` DB columns.
                May also include ``raw_sections`` (dict) or
                ``raw_sections_json`` (str) for section-level lookup.

    Returns:
        Extracted textbook string, or ``None`` if no confident match.
    """
    # Priority 1: explicit section key in raw_sections
    raw_sections = detail.get("raw_sections") or {}
    if not raw_sections:
        rsj = detail.get("raw_sections_json")
        if rsj:
            try:
                raw_sections = json.loads(rsj)
            except (ValueError, TypeError):
                raw_sections = {}

    for key, value in (raw_sections or {}).items():
        if re.search(
            r"^(?:教材|教科書|Textbook|Course\s*Materials)$", key, re.IGNORECASE
        ):
            cleaned = _clean(value)
            if _MIN_LEN <= len(cleaned) <= _MAX_LEN:
                return cleaned

    # Priority 2–4: search text fields
    for field_name in ("reference_books", "teaching_goal", "course_description"):
        text = detail.get(field_name) or ""
        if not text:
            continue
        result = _extract_from_text(text)
        if result is not None:
            return result

    return None


# ---------------------------------------------------------------------------
# Internal helpers


def _extract_from_text(text: str) -> Optional[str]:
    """Apply all extraction strategies to a single text field."""
    # Strategy A: "no textbook" declaration
    if _NO_TEXTBOOK_PAT.search(text):
        return _NO_TEXTBOOK

    # Strategy B: colon pattern anchored to line start
    m = _LINE_COLON_PAT.search(text)
    if m:
        after = text[m.end():]
        # Truncate at the first stop-label line
        stop_m = _STOP_PAT.search(after)
        if stop_m:
            after = after[: stop_m.start()]
        result = _clean(after)
        if len(result) < _MIN_LEN:
            return None          # empty or punctuation-only
        if len(result) > _MAX_LEN:
            return None          # suspiciously long — reject
        return result

    # Strategy C: entire field (or first line) is a standalone handout marker
    stripped = text.strip()
    if _STANDALONE_PAT.fullmatch(stripped):
        cleaned = stripped.rstrip("。！!")
        return cleaned if len(cleaned) >= _MIN_LEN else None

    first = _first_nonempty_line(text)
    if first and _STANDALONE_PAT.fullmatch(first):
        cleaned = first.rstrip("。！!")
        return cleaned if len(cleaned) >= _MIN_LEN else None

    return None


def _clean(text: str) -> str:
    """Strip surrounding blank lines and leading/trailing whitespace."""
    lines = text.splitlines()
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines).strip()


def _first_nonempty_line(text: str) -> Optional[str]:
    for line in text.splitlines():
        if line.strip():
            return line.strip()
    return None


def _detect_keyword(detail: dict) -> Optional[str]:
    """Return the triggering keyword/marker for this detail, or None (for stats)."""
    raw_sections = detail.get("raw_sections") or {}
    if not raw_sections:
        rsj = detail.get("raw_sections_json")
        if rsj:
            try:
                raw_sections = json.loads(rsj)
            except (ValueError, TypeError):
                raw_sections = {}
    for key in (raw_sections or {}):
        if re.search(
            r"^(?:教材|教科書|Textbook|Course\s*Materials)$", key, re.IGNORECASE
        ):
            return key

    for field_name in ("reference_books", "teaching_goal", "course_description"):
        text = detail.get(field_name) or ""
        if not text:
            continue
        if _NO_TEXTBOOK_PAT.search(text):
            return "無指定教材"
        m = _MATCHED_KEYWORD_PAT.search(text)
        if m:
            return m.group(1)
        stripped = text.strip()
        if _STANDALONE_PAT.fullmatch(stripped):
            return stripped.rstrip("。！!")
        first = _first_nonempty_line(text)
        if first and _STANDALONE_PAT.fullmatch(first):
            return first

    return None


# ---------------------------------------------------------------------------
# Batch extraction


def run_extraction(
    *,
    year: int,
    semester: int,
    only_courses: Optional[list[str]] = None,
    limit: Optional[int] = None,
    dry_run: bool = False,
    n_samples: int = 5,
) -> dict[str, Any]:
    """Extract textbook info for all success details; optionally write back.

    Args:
        year: Academic year.
        semester: Semester (1 or 2).
        only_courses: Restrict to these course codes.
        limit: Max courses to process.
        dry_run: If True, do not write to DB.
        n_samples: Max samples collected per category.

    Returns:
        Report dict with statistics and sample data.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    query = (
        "SELECT cd.course_code, c.course_name, cd.course_description, cd.teaching_goal, "
        "cd.reference_books, cd.textbook, cd.raw_sections_json "
        "FROM course_details cd "
        "JOIN courses c USING(year, semester, course_code) "
        "WHERE cd.year=? AND cd.semester=? AND cd.fetch_status='success'"
    )
    args: list[Any] = [year, semester]
    if only_courses:
        placeholders = ",".join("?" * len(only_courses))
        query += f" AND course_code IN ({placeholders})"
        args.extend(only_courses)
    if limit:
        query += f" LIMIT {limit}"

    rows = conn.execute(query, args).fetchall()

    total_details = len(rows)
    attempted = 0
    extracted_count = 0
    unchanged_count = 0
    no_textbook_count = 0
    suspicious_long_count = 0
    keyword_counter: Counter = Counter()
    sample_extractions: list[dict] = []
    sample_no_textbook: list[dict] = []
    sample_suspicious: list[dict] = []

    for row in rows:
        attempted += 1
        detail = dict(row)
        existing = detail.get("textbook")
        textbook = extract_textbook(detail)

        if textbook == _NO_TEXTBOOK:
            no_textbook_count += 1

        # Detect suspicious long extractions (guard in extractor should prevent,
        # but track anything > 500 chars for transparency)
        if textbook and len(textbook) > 500:
            suspicious_long_count += 1
            if len(sample_suspicious) < n_samples:
                sample_suspicious.append(
                    {
                        "course_code": detail["course_code"],
                        "course_name": detail.get("course_name", ""),
                        "extracted_len": len(textbook),
                        "extracted_preview": textbook[:200],
                    }
                )

        keyword = _detect_keyword(detail)
        if keyword:
            keyword_counter[keyword] += 1

        if textbook is not None:
            if textbook != existing:
                extracted_count += 1
                if len(sample_extractions) < n_samples:
                    sample_extractions.append(
                        {
                            "course_code": detail["course_code"],
                            "course_name": detail.get("course_name", ""),
                            "textbook": textbook,
                            "matched_keyword": keyword,
                        }
                    )
                if not dry_run:
                    conn.execute(
                        "UPDATE course_details SET textbook=? "
                        "WHERE year=? AND semester=? AND course_code=?",
                        (textbook, year, semester, detail["course_code"]),
                    )
            else:
                unchanged_count += 1
        else:
            if not existing and len(sample_no_textbook) < n_samples:
                rb = detail.get("reference_books") or ""
                sample_no_textbook.append(
                    {
                        "course_code": detail["course_code"],
                        "course_name": detail.get("course_name", ""),
                        "reference_books_preview": rb[:100] if rb else None,
                    }
                )

    if not dry_run:
        conn.commit()
    conn.close()

    extraction_rate = extracted_count / total_details if total_details else 0.0
    return {
        "term": {"year": year, "semester": semester},
        "dry_run": dry_run,
        "total_details": total_details,
        "attempted": attempted,
        "extracted_count": extracted_count,
        "unchanged_count": unchanged_count,
        "no_textbook_count": no_textbook_count,
        "suspicious_long_count": suspicious_long_count,
        "extraction_rate": round(extraction_rate * 100, 1),
        "top_keyword_distribution": keyword_counter.most_common(15),
        "sample_extractions": sample_extractions,
        "sample_no_textbook": sample_no_textbook,
        "sample_suspicious": sample_suspicious,
    }


# ---------------------------------------------------------------------------
# Markdown report


def build_markdown_report(report: dict) -> str:
    term = report["term"]
    y, s = term["year"], term["semester"]
    dry = " (dry-run)" if report.get("dry_run") else ""
    total = report["total_details"]
    extracted = report["extracted_count"]
    unchanged = report["unchanged_count"]
    no_tb = report["no_textbook_count"]
    susp = report["suspicious_long_count"]
    rate = report["extraction_rate"]

    lines: list[str] = [
        f"# Textbook Extraction Report — {y}-{s}{dry}",
        "",
        f"> Generated automatically by "
        f"`python -m ccsp_importer.cli extract-textbooks --year {y} --semester {s}`",
        "",
        "---",
        "",
        "## 1. Summary",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
        f"| total_details | {total} |",
        f"| attempted | {report['attempted']} |",
        f"| extracted_count | {extracted} |",
        f"| unchanged_count | {unchanged} |",
        f"| no_textbook_count | {no_tb} |",
        f"| suspicious_long_count | {susp} |",
        f"| extraction_rate | {rate}% |",
        "",
        "## 2. Keyword Distribution",
        "",
        "| Keyword / Marker | Courses |",
        "| --- | ---: |",
    ]
    for kw, cnt in report["top_keyword_distribution"]:
        lines.append(f"| {kw} | {cnt} |")
    lines.append("")

    lines += [
        "## 3. Sample Extractions",
        "",
    ]
    if report["sample_extractions"]:
        lines += [
            "| course_code | course_name | keyword | textbook_preview |",
            "| --- | --- | --- | --- |",
        ]
        for smpl in report["sample_extractions"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            kw = (smpl.get("matched_keyword") or "—").replace("|", "｜")
            tb = (smpl.get("textbook") or "").replace("|", "｜")[:80]
            lines.append(f"| {smpl['course_code']} | {name} | {kw} | {tb} |")
    else:
        lines.append("_No new extractions._")
    lines.append("")

    lines += [
        "## 4. Suspicious Samples",
        "",
    ]
    if report["sample_suspicious"]:
        lines += [
            "| course_code | course_name | extracted_len | preview |",
            "| --- | --- | ---: | --- |",
        ]
        for smpl in report["sample_suspicious"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            preview = (smpl.get("extracted_preview") or "").replace("|", "｜")[:80]
            lines.append(
                f"| {smpl['course_code']} | {name} | {smpl['extracted_len']} | {preview} |"
            )
    else:
        lines.append("_None._")
    lines.append("")

    lines += [
        "## 5. No Textbook Samples",
        "",
    ]
    if report["sample_no_textbook"]:
        lines += [
            "| course_code | course_name | reference_books_preview |",
            "| --- | --- | --- |",
        ]
        for smpl in report["sample_no_textbook"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            rb = (smpl.get("reference_books_preview") or "—").replace("|", "｜")
            lines.append(f"| {smpl['course_code']} | {name} | {rb} |")
    else:
        lines.append("_None._")
    lines.append("")

    lines += [
        "## 6. Recommendations",
        "",
        f"- Extracted textbook for **{extracted}** courses ({rate}% of attempted).",
        "- `reference_books` 原文未被修改，textbook 欄位為獨立抽取結果。",
        "- 若 `suspicious_long_count > 0`，請人工確認相關課程的抽取結果是否正確。",
        "- 重複執行安全：已有 textbook 的課程若再次抽取到相同值，計為 `unchanged_count`。",
        "- 若需調整規則，修改 `textbook_extractor.py` 後重跑即可（冪等）。",
        "",
        "---",
        f"_Report for {y}-{s}. Extracted: {extracted}/{total}, Rate: {rate}%._",
    ]

    return "\n".join(lines)


def write_report(report: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_markdown_report(report), encoding="utf-8")
