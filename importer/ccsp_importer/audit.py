"""Data-quality audit over the courses table.

Run as: `python -m ccsp_importer.ccsp_importer.audit --year 114 --semester 1`
or, with the working directory set to `importer/`:
        `python -m ccsp_importer.audit --year 114 --semester 1`
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from collections import Counter
from typing import Any

from .config import DB_PATH


# ---------------------------------------------------------------------------
# Heuristics

# A "well-formed" 時間地點 raw string is a sequence of `星期X/PERIODS[ROOM]`
# blocks separated by spaces. Anything that has 星期 but doesn't conform
# is flagged for human inspection.
_TIME_OK_RE = re.compile(
    r"^(?:星期[一二三四五六日天]\s*/\s*[^\[\s]+\s*\[[^\]]+\]\s*)+$"
)

# raw_note shouldn't start or end with stray punctuation/separators.
_NOTE_BAD_PREFIX_RE = re.compile(r"^[/\\\s,，;；·•·]+")
_NOTE_BAD_SUFFIX_RE = re.compile(r"[/\\\s]+$")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--semester", type=int, required=True, choices=[1, 2])
    parser.add_argument(
        "--samples",
        type=int,
        default=8,
        help="Max sample rows to include for anomaly categories",
    )
    args = parser.parse_args()

    report = build_report(year=args.year, semester=args.semester, n_samples=args.samples)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


# ---------------------------------------------------------------------------
# Audit core

def build_report(*, year: int, semester: int, n_samples: int) -> dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    base = "FROM courses WHERE year = ? AND semester = ?"
    args = (year, semester)

    total_courses = _scalar(conn, f"SELECT COUNT(*) {base}", args)
    total_departments = _scalar(
        conn, f"SELECT COUNT(DISTINCT dept_code) {base}", args
    )

    failed_departments = [
        dict(r)
        for r in conn.execute(
            """SELECT dept_code, dept_name, http_status, course_count
                 FROM scrape_runs
                WHERE year = ? AND semester = ?
                  AND (http_status IS NULL OR http_status >= 400 OR course_count = 0)
                ORDER BY dept_code""",
            args,
        ).fetchall()
    ]

    # Empty fields ----------------------------------------------------------
    empty_code = _samples(
        conn,
        f"SELECT id, dept_code, course_code, course_name {base} AND (course_code IS NULL OR course_code='')",
        args,
        n_samples,
    )
    empty_name = _samples(
        conn,
        f"SELECT id, dept_code, course_code, course_name {base} AND (course_name IS NULL OR course_name='')",
        args,
        n_samples,
    )

    # Missing schedule data -------------------------------------------------
    no_time = _scalar(
        conn,
        f"SELECT COUNT(*) {base} AND (time_raw IS NULL OR time_slots_json IN ('', '[]'))",
        args,
    )
    no_teacher = _scalar(
        conn,
        f"SELECT COUNT(*) {base} AND (teachers_json IS NULL OR teachers_json IN ('', '[]'))",
        args,
    )
    no_capacity = _scalar(
        conn, f"SELECT COUNT(*) {base} AND capacity IS NULL", args
    )
    no_enrolled = _scalar(
        conn, f"SELECT COUNT(*) {base} AND enrolled IS NULL", args
    )

    # When time_raw exists but no slots got parsed, that's a parser bug.
    time_present_no_slots = _samples(
        conn,
        f"""SELECT id, dept_code, course_code, course_name, time_raw
              {base}
               AND time_raw IS NOT NULL
               AND time_raw <> ''
               AND time_raw <> '無資料'
               AND time_slots_json = '[]'""",
        args,
        n_samples,
    )

    # When time_slots exists but classroom is null on every slot.
    no_classroom_full = _scalar(
        conn,
        f"""SELECT COUNT(*)
              {base}
               AND time_slots_json LIKE '%"classroom": null%'
               AND time_slots_json NOT LIKE '%"classroom": "%'""",
        args,
    )

    # Period tokens should be digits or letters only — never contain "/".
    # A "/" inside a period token means the multi-day separator wasn't split
    # correctly (regression smell).
    corrupt_period_token_count = _scalar(
        conn,
        f"SELECT COUNT(*) {base} AND time_slots_json LIKE '%/%'",
        args,
    )
    corrupt_period_token_samples = _samples(
        conn,
        f"SELECT id, dept_code, course_code, course_name, time_raw, time_slots_json {base} AND time_slots_json LIKE '%/%'",
        args,
        n_samples,
    )

    # Time-format outliers --------------------------------------------------
    abnormal_time = []
    for r in conn.execute(
        f"SELECT id, dept_code, course_code, course_name, time_raw {base} AND time_raw IS NOT NULL AND time_raw <> '無資料'",
        args,
    ).fetchall():
        if not _TIME_OK_RE.match(r["time_raw"] or ""):
            abnormal_time.append(dict(r))
            if len(abnormal_time) >= n_samples:
                break

    # Note hygiene ----------------------------------------------------------
    abnormal_notes = []
    for r in conn.execute(
        f"SELECT id, dept_code, course_code, raw_note {base} AND raw_note IS NOT NULL",
        args,
    ).fetchall():
        n = r["raw_note"] or ""
        if _NOTE_BAD_PREFIX_RE.search(n) or _NOTE_BAD_SUFFIX_RE.search(n):
            abnormal_notes.append(dict(r))
            if len(abnormal_notes) >= n_samples:
                break

    # Enrollment sanity (enrolled >= 0, capacity >= 0, remaining matches when both known)
    enrollment_anomalies = _samples(
        conn,
        f"""SELECT id, dept_code, course_code, capacity, enrolled, remaining
              {base}
               AND (
                    capacity < 0 OR enrolled < 0
                 OR (capacity IS NOT NULL AND enrolled IS NOT NULL AND remaining IS NOT NULL
                     AND remaining <> capacity - enrolled
                     AND remaining <> 0)
               )""",
        args,
        n_samples,
    )

    # Duplicate course_code within the same semester ------------------------
    dup_codes = [
        dict(r)
        for r in conn.execute(
            f"""SELECT course_code, COUNT(*) AS n
                  {base}
                 GROUP BY course_code
                HAVING n > 1
                ORDER BY n DESC, course_code
                LIMIT ?""",
            (*args, n_samples),
        ).fetchall()
    ]

    # Cross-dept duplicate detection: same (course_name, teachers, time)
    # appearing under two different course codes — could indicate a section
    # split. This is informational, not necessarily a parser bug.
    cross_dupes = [
        dict(r)
        for r in conn.execute(
            f"""SELECT course_name, COUNT(DISTINCT course_code) AS codes,
                       COUNT(DISTINCT dept_code) AS depts
                  {base}
                 GROUP BY course_name
                HAVING depts > 1
                ORDER BY depts DESC, codes DESC
                LIMIT ?""",
            (*args, n_samples),
        ).fetchall()
    ]

    # Per-dept summary ------------------------------------------------------
    dept_summary = [
        dict(r)
        for r in conn.execute(
            f"""SELECT dept_code, dept_name, COUNT(*) AS courses
                  {base}
                 GROUP BY dept_code, dept_name
                ORDER BY dept_code""",
            args,
        ).fetchall()
    ]

    return {
        "term": {"year": year, "semester": semester},
        "totals": {
            "total_courses": total_courses,
            "total_departments": total_departments,
            "failed_departments": failed_departments,
        },
        "missing_fields": {
            "courses_without_time": no_time,
            "courses_without_teacher": no_teacher,
            "courses_without_classroom_on_any_slot": no_classroom_full,
            "courses_without_capacity": no_capacity,
            "courses_without_enrolled": no_enrolled,
            "empty_course_code_samples": empty_code,
            "empty_course_name_samples": empty_name,
        },
        "parser_issues": {
            "time_present_no_slots_parsed": time_present_no_slots,
            "abnormal_time_format_samples": abnormal_time,
            "abnormal_note_samples": abnormal_notes,
            "enrollment_anomaly_samples": enrollment_anomalies,
            "corrupt_period_token_count": corrupt_period_token_count,
            "corrupt_period_token_samples": corrupt_period_token_samples,
        },
        "duplicates": {
            "duplicate_course_codes": dup_codes,
            "cross_dept_same_name_samples": cross_dupes,
        },
        "departments_summary": dept_summary,
    }


# ---------------------------------------------------------------------------
# helpers

def _scalar(conn: sqlite3.Connection, sql: str, args) -> int:
    row = conn.execute(sql, args).fetchone()
    return int(row[0]) if row else 0


def _samples(conn: sqlite3.Connection, sql: str, args, limit: int) -> list[dict]:
    return [
        dict(r)
        for r in conn.execute(sql + " LIMIT ?", (*args, limit)).fetchall()
    ]


if __name__ == "__main__":
    sys.exit(main())
