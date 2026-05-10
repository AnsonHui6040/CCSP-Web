"""Detail-page data-quality audit for course_details.

Run as:
    python -m ccsp_importer.cli audit-details --year 114 --semester 1
"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

from .config import DB_PATH, REPO_ROOT


# ---------------------------------------------------------------------------
# Public API


def build_detail_audit(*, year: int, semester: int, n_samples: int = 5) -> dict[str, Any]:
    """Query course_details and return a structured audit report dict."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    base_args = (year, semester)

    total_courses = conn.execute(
        "SELECT COUNT(*) FROM courses WHERE year=? AND semester=?", base_args
    ).fetchone()[0]

    total_in_details = conn.execute(
        "SELECT COUNT(*) FROM course_details WHERE year=? AND semester=?", base_args
    ).fetchone()[0]

    # --- fetch_status breakdown ---
    status_rows = conn.execute(
        "SELECT fetch_status, COUNT(*) as cnt FROM course_details "
        "WHERE year=? AND semester=? GROUP BY fetch_status ORDER BY cnt DESC",
        base_args,
    ).fetchall()
    fetch_status_dist = {r["fetch_status"]: r["cnt"] for r in status_rows}

    success_count = fetch_status_dist.get("success", 0)
    skipped_count = fetch_status_dist.get("skipped", 0)
    parse_error_count = fetch_status_dist.get("parse_error", 0)
    http_error_count = fetch_status_dist.get("http_error", 0)
    not_found_count = fetch_status_dist.get("not_found", 0)

    # courses not yet attempted
    not_attempted = total_courses - total_in_details

    # --- field coverage (among success rows) ---
    def cov(column: str) -> int:
        return conn.execute(
            f"SELECT COUNT(*) FROM course_details "
            f"WHERE year=? AND semester=? AND fetch_status='success' "
            f"AND {column} IS NOT NULL AND TRIM({column}) <> '' "
            f"AND {column} <> '[]' AND {column} <> '{{}}'",
            base_args,
        ).fetchone()[0]

    coverage = {
        "course_description": cov("course_description"),
        "teaching_goal": cov("teaching_goal"),
        "grading_policy": cov("grading_policy_json"),
        "textbook": cov("textbook"),
        "reference_books": cov("reference_books"),
        "office_hour": cov("office_hour"),
        "syllabus_url": cov("syllabus_url"),
        "detailed_note": cov("detailed_note"),
    }

    # --- section_frequency from raw_sections_json ---
    section_counter: Counter = Counter()
    section_total = 0
    section_courses = 0
    sample_raw_sections: list[dict] = []

    rows = conn.execute(
        "SELECT course_code, raw_sections_json FROM course_details "
        "WHERE year=? AND semester=? AND fetch_status='success' AND raw_sections_json IS NOT NULL",
        base_args,
    ).fetchall()
    for r in rows:
        try:
            obj = json.loads(r["raw_sections_json"]) if r["raw_sections_json"] else {}
        except json.JSONDecodeError:
            continue
        if not obj:
            continue
        section_total += len(obj)
        section_courses += 1
        for k in obj:
            section_counter[k] += 1
        if len(sample_raw_sections) < 3:
            sample_raw_sections.append(
                {"course_code": r["course_code"], "section_keys": list(obj.keys())}
            )

    avg_sections = round(section_total / section_courses, 2) if section_courses else 0.0

    # --- missing section frequency: keys in most courses but absent in some ---
    # "missing" = key present in ≥50% of courses but absent in certain courses
    missing_counter: Counter = Counter()
    if section_courses > 0:
        threshold = section_courses * 0.5
        common_keys = {k for k, v in section_counter.items() if v >= threshold}
        for r in rows:
            try:
                obj = json.loads(r["raw_sections_json"]) if r["raw_sections_json"] else {}
            except json.JSONDecodeError:
                continue
            for k in common_keys:
                if k not in obj:
                    missing_counter[k] += 1

    # --- error samples ---
    sample_parse_errors = _error_samples(conn, year, semester, "parse_error", n_samples)
    sample_http_errors = _error_samples(conn, year, semester, "http_error", n_samples)
    sample_not_found = _error_samples(conn, year, semester, "not_found", n_samples)

    conn.close()

    return {
        "term": {"year": year, "semester": semester},
        "total_courses": total_courses,
        "total_in_course_details": total_in_details,
        "not_attempted": not_attempted,
        "fetch_status_distribution": fetch_status_dist,
        "success_count": success_count,
        "skipped_count": skipped_count,
        "parse_error_count": parse_error_count,
        "http_error_count": http_error_count,
        "not_found_count": not_found_count,
        "field_coverage": coverage,
        "average_sections_per_course": avg_sections,
        "section_frequency": section_counter.most_common(),
        "missing_section_frequency": missing_counter.most_common(),
        "sample_raw_sections": sample_raw_sections,
        "sample_parse_errors": sample_parse_errors,
        "sample_http_errors": sample_http_errors,
        "sample_not_found": sample_not_found,
    }


def _error_samples(
    conn: sqlite3.Connection,
    year: int,
    semester: int,
    status: str,
    n: int,
) -> list[dict]:
    rows = conn.execute(
        "SELECT d.year, d.semester, d.course_code, c.course_name, d.detail_url, d.error_message "
        "FROM course_details d "
        "LEFT JOIN courses c ON c.year=d.year AND c.semester=d.semester AND c.course_code=d.course_code "
        "WHERE d.year=? AND d.semester=? AND d.fetch_status=? "
        "ORDER BY d.fetched_at DESC LIMIT ?",
        (year, semester, status, n),
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Markdown report


def build_markdown_report(report: dict) -> str:
    term = report["term"]
    y, s = term["year"], term["semester"]
    total = report["total_courses"]
    success = report["success_count"]
    parse_err = report["parse_error_count"]
    http_err = report["http_error_count"]
    not_found = report["not_found_count"]
    skipped = report["skipped_count"]
    not_attempted = report["not_attempted"]
    total_in_db = report["total_in_course_details"]

    def pct(n: int) -> str:
        return f"{n / success * 100:.1f}%" if success else "N/A"

    lines: list[str] = []

    lines += [
        f"# Detail Scrape Audit — {y}-{s}",
        "",
        f"> Generated automatically by `python -m ccsp_importer.cli audit-details --year {y} --semester {s}`",
        "",
        "---",
        "",
        "## 1. Summary",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
        f"| total_courses | {total} |",
        f"| total_in_course_details | {total_in_db} |",
        f"| not_attempted | {not_attempted} |",
        f"| success_count | {success} |",
        f"| skipped_count | {skipped} |",
        f"| parse_error_count | {parse_err} |",
        f"| http_error_count | {http_err} |",
        f"| not_found_count | {not_found} |",
        "",
    ]

    lines += [
        "## 2. Fetch Status Distribution",
        "",
        "| fetch_status | count |",
        "| --- | ---: |",
    ]
    for status, cnt in sorted(report["fetch_status_distribution"].items(), key=lambda x: -x[1]):
        lines.append(f"| {status} | {cnt} |")
    lines.append("")

    lines += [
        "## 3. Field Coverage",
        "",
        f"Coverage % is relative to `success_count = {success}`.",
        "",
        "| Field | Count | Coverage |",
        "| --- | ---: | ---: |",
    ]
    for field, count in report["field_coverage"].items():
        lines.append(f"| {field} | {count} | {pct(count)} |")
    lines.append("")

    lines += [
        "## 4. Section Frequency",
        "",
        "Most common section keys in `raw_sections_json` (across all successful courses):",
        "",
        "| Section Key | Appears In |",
        "| --- | ---: |",
    ]
    for key, cnt in (report["section_frequency"] or [])[:20]:
        lines.append(f"| {key} | {cnt} |")
    lines.append("")

    lines += [
        "## 5. Missing Sections",
        "",
        "Sections that appear in ≥50% of courses but are absent in some:",
        "",
        "| Section Key | Missing In |",
        "| --- | ---: |",
    ]
    if report["missing_section_frequency"]:
        for key, cnt in (report["missing_section_frequency"] or [])[:10]:
            lines.append(f"| {key} | {cnt} |")
    else:
        lines.append("_No missing sections above threshold._")
    lines.append("")

    lines += [
        "## 6. Error Samples",
        "",
        "### parse_error",
        "",
    ]
    if report["sample_parse_errors"]:
        lines += [
            "| course_code | course_name | error_message |",
            "| --- | --- | --- |",
        ]
        for smpl in report["sample_parse_errors"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            err = (smpl.get("error_message") or "").replace("|", "｜")[:120]
            lines.append(f"| {smpl.get('course_code')} | {name} | {err} |")
    else:
        lines.append("_None._")
    lines.append("")

    lines += ["### http_error", ""]
    if report["sample_http_errors"]:
        lines += [
            "| course_code | course_name | error_message |",
            "| --- | --- | --- |",
        ]
        for smpl in report["sample_http_errors"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            err = (smpl.get("error_message") or "").replace("|", "｜")[:120]
            lines.append(f"| {smpl.get('course_code')} | {name} | {err} |")
    else:
        lines.append("_None._")
    lines.append("")

    lines += ["### not_found", ""]
    if report["sample_not_found"]:
        lines += [
            "| course_code | course_name | detail_url |",
            "| --- | --- | --- |",
        ]
        for smpl in report["sample_not_found"]:
            name = (smpl.get("course_name") or "").replace("|", "｜")
            url = smpl.get("detail_url") or smpl.get("error_message") or ""
            lines.append(f"| {smpl.get('course_code')} | {name} | {url} |")
    else:
        lines.append("_None._")
    lines.append("")

    lines += [
        "## 7. Raw Sections Samples",
        "",
    ]
    if report["sample_raw_sections"]:
        for sample in report["sample_raw_sections"]:
            keys_str = ", ".join(f"`{k}`" for k in sample["section_keys"])
            lines.append(f"- **{sample['course_code']}**: {keys_str}")
    else:
        lines.append("_No successful courses yet._")
    lines.append("")

    lines += [
        "## 8. HTML Variants",
        "",
        "目前未發現明顯 HTML page variant（所有課程使用相同的 `/view/{y}/{s}/{code}` 結構）。",
        "若 parse_error_count > 0，請查看 §6 的錯誤樣本並人工確認對應的 `.html` 快取檔。",
        "",
    ]

    # --- recommendations ---
    lines += [
        "## 9. Recommendations",
        "",
    ]
    recs: list[str] = []
    if parse_err > 0:
        recs.append(
            f"- **修 parser**：發現 {parse_err} 筆 parse_error。"
            "請查看 `sample_parse_errors` 對應的 HTML 快取（`data/raw/114-1/details/{code}.html`），"
            "修 `parse_detail.py` 並 bump `DETAIL_PARSER_VERSION`，再重跑（已快取，無需重新聯網）。"
        )
    if not_found > 0:
        recs.append(
            f"- **not_found {not_found} 筆**：課號在 courses 表存在但 `/view/` 頁面回 404，屬正常（資料不一致），不需重試。"
        )
    cov = report["field_coverage"]
    if cov.get("textbook", 0) == 0:
        recs.append(
            "- **textbook 欄位覆蓋率 0%**：THU 頁面多為「參考書目」section，沒有獨立教材 section。"
            "建議進行 P7 textbook extractor，以 rule-based regex 從 `teaching_goal` / `course_description` 抽取。"
        )
    elif success > 0 and cov.get("textbook", 0) / success < 0.1:
        recs.append(
            f"- **textbook 覆蓋率低（{pct(cov.get('textbook', 0))}）**：建議做 P7 textbook extractor 強化。"
        )
    if not_attempted > 0:
        recs.append(
            f"- **{not_attempted} 門課尚未嘗試**：重跑 `scrape-details` 補完，或確認是否有問題。"
        )
    if not recs:
        recs.append("- 目前資料品質良好，可進入下一階段。")
    lines += recs
    lines.append("")

    lines += [
        "---",
        f"_Audit generated for {y}-{s}. Total courses: {total}, Success: {success}, "
        f"Coverage: {success/total*100:.1f}% of all courses._",
    ]

    return "\n".join(lines)


def write_report(report: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    md = build_markdown_report(report)
    output_path.write_text(md, encoding="utf-8")
