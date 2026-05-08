"""Per-course detail scraper.

Resumable: skips courses already at `fetch_status='success'` unless
`--force` is set. Cache-aware: every fetched HTML lands in
`data/raw/{y}-{s}/details/{code}.html` so re-running with the same
parser version is offline.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from . import db
from .config import (
    BASE,
    COURSE_DETAIL_URL,
    DATA_DIR,
    DB_PATH,
    DETAIL_PARSER_VERSION,
    REQUEST_DELAY_SEC,
)
from .http_client import PoliteSession
from .parse_detail import parse_course_detail

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API


def scrape_details(
    *,
    year: int,
    semester: int,
    only_courses: Optional[Iterable[str]] = None,
    only_dept: Optional[str] = None,
    limit: Optional[int] = None,
    force: bool = False,
    only_missing: bool = True,
    sleep_sec: float = REQUEST_DELAY_SEC,
    use_cache: bool = True,
    session: Optional[PoliteSession] = None,
    cache_dir: Optional[Path] = None,
) -> dict:
    """Scrape per-course detail pages for one term.

    Returns a stats dict suitable for printing as the data-quality report.
    """
    db.init_db()
    cache_dir = cache_dir or (DATA_DIR / "raw" / f"{year}-{semester}" / "details")
    cache_dir.mkdir(parents=True, exist_ok=True)
    session = session or PoliteSession(delay_sec=sleep_sec)

    todo = _select_courses(
        year=year,
        semester=semester,
        only_courses=only_courses,
        only_dept=only_dept,
        limit=limit,
        force=force,
        only_missing=only_missing,
    )
    log.info("scrape-details: %d courses queued", len(todo))

    statuses = Counter()
    parser_errors: list[dict] = []
    for i, (code, dept_code) in enumerate(todo, start=1):
        log.info(
            "[%d/%d] year=%s sem=%s code=%s dept=%s",
            i, len(todo), year, semester, code, dept_code,
        )
        result = _scrape_one(
            year=year,
            semester=semester,
            course_code=code,
            session=session,
            cache_dir=cache_dir,
            use_cache=use_cache,
        )
        statuses[result["fetch_status"]] += 1
        if result["fetch_status"] == "parse_error" and len(parser_errors) < 5:
            parser_errors.append(
                {"course_code": code, "error": result.get("error_message")}
            )
    log.info("done: %s", dict(statuses))
    return _build_report(year=year, semester=semester, statuses=statuses, parser_errors=parser_errors)


# ---------------------------------------------------------------------------
# Course selection
# ---------------------------------------------------------------------------


def _select_courses(
    *,
    year: int,
    semester: int,
    only_courses: Optional[Iterable[str]],
    only_dept: Optional[str],
    limit: Optional[int],
    force: bool,
    only_missing: bool,
) -> list[tuple[str, Optional[str]]]:
    """Resolve the queued courses against `courses` + `course_details`."""
    args: list = [year, semester]
    sql = (
        "SELECT c.course_code, c.dept_code FROM courses c "
        "LEFT JOIN course_details d "
        "  ON d.year = c.year AND d.semester = c.semester AND d.course_code = c.course_code "
        "WHERE c.year = ? AND c.semester = ? "
    )
    if only_courses:
        codes = list(only_courses)
        sql += f"AND c.course_code IN ({','.join('?' for _ in codes)}) "
        args.extend(codes)
    if only_dept:
        sql += "AND c.dept_code = ? "
        args.append(only_dept)
    if not force and only_missing:
        sql += (
            "AND (d.fetch_status IS NULL "
            "     OR d.fetch_status != 'success' "
            "     OR d.parser_version != ?) "
        )
        args.append(DETAIL_PARSER_VERSION)
    sql += "ORDER BY c.dept_code, c.course_code "
    if limit is not None:
        sql += "LIMIT ?"
        args.append(int(limit))

    with db.connect() as conn:
        rows = conn.execute(sql, args).fetchall()
    return [(r["course_code"], r["dept_code"]) for r in rows]


# ---------------------------------------------------------------------------
# Per-course scrape


def _scrape_one(
    *,
    year: int,
    semester: int,
    course_code: str,
    session: PoliteSession,
    cache_dir: Path,
    use_cache: bool,
) -> dict:
    cache_path = cache_dir / f"{course_code}.html"
    html: Optional[str] = None
    http_status: Optional[int] = None

    if use_cache and cache_path.exists():
        html = cache_path.read_text(encoding="utf-8")
        http_status = 200  # served from cache
    else:
        url = COURSE_DETAIL_URL.format(year=year, sem=semester, code=course_code)
        try:
            resp = session.get(url)
            http_status = resp.status_code
            if resp.status_code == 404:
                _persist_failure(
                    year, semester, course_code,
                    fetch_status="not_found",
                    error_message=f"HTTP 404 for {url}",
                    http_status=resp.status_code,
                )
                return {"fetch_status": "not_found"}
            if resp.status_code >= 400:
                _persist_failure(
                    year, semester, course_code,
                    fetch_status="http_error",
                    error_message=f"HTTP {resp.status_code} for {url}",
                    http_status=resp.status_code,
                )
                return {"fetch_status": "http_error"}
            resp.encoding = resp.apparent_encoding or "utf-8"
            html = resp.text
            if use_cache:
                cache_path.write_text(html, encoding="utf-8")
        except Exception as exc:
            _persist_failure(
                year, semester, course_code,
                fetch_status="http_error",
                error_message=f"network error: {exc!r}",
                http_status=None,
            )
            return {"fetch_status": "http_error", "error_message": str(exc)}

    # Parse
    try:
        parsed = parse_course_detail(
            html, year=year, semester=semester, course_code=course_code
        )
    except Exception as exc:
        _persist_failure(
            year, semester, course_code,
            fetch_status="parse_error",
            error_message=f"{type(exc).__name__}: {exc}",
            http_status=http_status,
        )
        return {"fetch_status": "parse_error", "error_message": str(exc)}

    _persist_success(year, semester, course_code, parsed, http_status=http_status)
    return {"fetch_status": "success"}


# ---------------------------------------------------------------------------
# DB writes


_UPSERT_DETAILS = """
INSERT INTO course_details (
  year, semester, course_code,
  detail_url, course_description, teaching_goal,
  grading_policy_json, textbook, reference_books,
  office_hour, syllabus_url, detailed_note,
  teachers_json, teaching_assistants_json, raw_sections_json,
  fetched_at, parser_version, fetch_status, error_message
) VALUES (
  :year, :semester, :course_code,
  :detail_url, :course_description, :teaching_goal,
  :grading_policy_json, :textbook, :reference_books,
  :office_hour, :syllabus_url, :detailed_note,
  :teachers_json, :teaching_assistants_json, :raw_sections_json,
  :fetched_at, :parser_version, :fetch_status, :error_message
)
ON CONFLICT (year, semester, course_code) DO UPDATE SET
  detail_url               = excluded.detail_url,
  course_description       = excluded.course_description,
  teaching_goal            = excluded.teaching_goal,
  grading_policy_json      = excluded.grading_policy_json,
  textbook                 = excluded.textbook,
  reference_books          = excluded.reference_books,
  office_hour              = excluded.office_hour,
  syllabus_url             = excluded.syllabus_url,
  detailed_note            = excluded.detailed_note,
  teachers_json            = excluded.teachers_json,
  teaching_assistants_json = excluded.teaching_assistants_json,
  raw_sections_json        = excluded.raw_sections_json,
  fetched_at               = excluded.fetched_at,
  parser_version           = excluded.parser_version,
  fetch_status             = excluded.fetch_status,
  error_message            = excluded.error_message
"""


def _persist_success(
    year: int, semester: int, course_code: str, parsed: dict, http_status: int | None
) -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    row = {
        "year": year,
        "semester": semester,
        "course_code": course_code,
        "detail_url": parsed.get("detail_url"),
        "course_description": parsed.get("course_description"),
        "teaching_goal": parsed.get("teaching_goal"),
        "grading_policy_json": json.dumps(
            parsed.get("grading_policy") or [], ensure_ascii=False
        ),
        "textbook": parsed.get("textbook"),
        "reference_books": parsed.get("reference_books"),
        "office_hour": parsed.get("office_hour"),
        "syllabus_url": parsed.get("syllabus_url"),
        "detailed_note": parsed.get("detailed_note"),
        "teachers_json": json.dumps(parsed.get("teachers") or [], ensure_ascii=False),
        "teaching_assistants_json": json.dumps(
            parsed.get("teaching_assistants") or [], ensure_ascii=False
        ),
        "raw_sections_json": json.dumps(
            parsed.get("raw_sections") or {}, ensure_ascii=False
        ),
        "fetched_at": now,
        "parser_version": DETAIL_PARSER_VERSION,
        "fetch_status": "success",
        "error_message": None,
    }
    with db.connect() as conn:
        conn.execute(_UPSERT_DETAILS, row)
        _record_run(conn, year, semester, course_code, http_status, "success", None, now)


def _persist_failure(
    year: int,
    semester: int,
    course_code: str,
    *,
    fetch_status: str,
    error_message: str,
    http_status: int | None,
) -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Keep an audit row but do NOT overwrite a previous successful row's
    # parsed fields — only update the status/error metadata. This way a
    # transient failure doesn't blow away yesterday's good data.
    with db.connect() as conn:
        existing = conn.execute(
            "SELECT 1 FROM course_details WHERE year=? AND semester=? AND course_code=?",
            (year, semester, course_code),
        ).fetchone()
        if existing is None:
            row = {
                "year": year, "semester": semester, "course_code": course_code,
                "detail_url": None, "course_description": None, "teaching_goal": None,
                "grading_policy_json": None, "textbook": None, "reference_books": None,
                "office_hour": None, "syllabus_url": None, "detailed_note": None,
                "teachers_json": None, "teaching_assistants_json": None,
                "raw_sections_json": None,
                "fetched_at": now, "parser_version": DETAIL_PARSER_VERSION,
                "fetch_status": fetch_status, "error_message": error_message,
            }
            conn.execute(_UPSERT_DETAILS, row)
        else:
            conn.execute(
                "UPDATE course_details SET fetch_status=?, error_message=?, fetched_at=? "
                "WHERE year=? AND semester=? AND course_code=?",
                (fetch_status, error_message, now, year, semester, course_code),
            )
        _record_run(conn, year, semester, course_code, http_status, fetch_status, error_message, now)


def _record_run(
    conn: sqlite3.Connection,
    year: int,
    semester: int,
    course_code: str,
    http_status: int | None,
    fetch_status: str,
    error_message: str | None,
    scraped_at: str,
) -> None:
    conn.execute(
        "INSERT INTO detail_scrape_runs "
        "(year, semester, course_code, http_status, fetch_status, error_message, scraped_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (year, semester, course_code, http_status, fetch_status, error_message, scraped_at),
    )


# ---------------------------------------------------------------------------
# Data quality report
# ---------------------------------------------------------------------------


def _build_report(
    *, year: int, semester: int, statuses: Counter, parser_errors: list[dict]
) -> dict:
    with db.connect() as conn:
        def has_count(column: str) -> int:
            return conn.execute(
                f"SELECT COUNT(*) FROM course_details "
                f"WHERE year=? AND semester=? AND fetch_status='success' "
                f"AND {column} IS NOT NULL AND {column} <> '' "
                f"AND {column} <> '[]' AND {column} <> '{{}}'",
                (year, semester),
            ).fetchone()[0]

        success_total = conn.execute(
            "SELECT COUNT(*) FROM course_details WHERE year=? AND semester=? AND fetch_status='success'",
            (year, semester),
        ).fetchone()[0]
        attempted = conn.execute(
            "SELECT COUNT(*) FROM course_details WHERE year=? AND semester=?",
            (year, semester),
        ).fetchone()[0]
        all_courses = conn.execute(
            "SELECT COUNT(*) FROM courses WHERE year=? AND semester=?",
            (year, semester),
        ).fetchone()[0]

        coverage = {
            "courses_with_description": has_count("course_description"),
            "courses_with_teaching_goal": has_count("teaching_goal"),
            "courses_with_grading_policy": has_count("grading_policy_json"),
            "courses_with_textbook": has_count("textbook"),
            "courses_with_reference_books": has_count("reference_books"),
            "courses_with_office_hour": has_count("office_hour"),
            "courses_with_syllabus_url": has_count("syllabus_url"),
            "courses_with_detailed_note": has_count("detailed_note"),
        }

        section_counts: Counter = Counter()
        sample_raw_sections: list[dict] = []
        section_total = 0
        section_courses = 0
        rows = conn.execute(
            "SELECT course_code, raw_sections_json FROM course_details "
            "WHERE year=? AND semester=? AND fetch_status='success' AND raw_sections_json IS NOT NULL",
            (year, semester),
        ).fetchall()
        for r in rows:
            try:
                obj = json.loads(r["raw_sections_json"]) if r["raw_sections_json"] else {}
            except json.JSONDecodeError:
                continue
            section_total += len(obj)
            section_courses += 1
            for k in obj:
                section_counts[k] += 1
            if len(sample_raw_sections) < 3:
                sample_raw_sections.append(
                    {"course_code": r["course_code"], "section_keys": list(obj.keys())}
                )
        avg_sections = (section_total / section_courses) if section_courses else 0.0

    return {
        "term": {"year": year, "semester": semester},
        "total_courses": all_courses,
        "attempted": attempted,
        "success_count": statuses.get("success", 0) or success_total,
        "skipped_count": statuses.get("skipped", 0),
        "parse_error_count": statuses.get("parse_error", 0),
        "http_error_count": statuses.get("http_error", 0),
        "not_found_count": statuses.get("not_found", 0),
        **coverage,
        "average_sections_per_course": round(avg_sections, 2),
        "section_frequency": section_counts.most_common(),
        "sample_parse_errors": parser_errors,
        "sample_raw_sections": sample_raw_sections,
    }
