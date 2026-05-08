"""SQLite persistence layer."""
from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, Sequence

from .config import DATA_DIR, DB_PATH, SCHEMA_PATH
from .models import Course

log = logging.getLogger(__name__)


def init_db(db_path: Path = DB_PATH) -> None:
    """Create the database file (if missing) and apply schema.sql.

    Also runs lightweight column migrations so DBs created before a schema
    extension don't need to be wiped.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with connect(db_path) as conn:
        conn.executescript(schema)
        _run_migrations(conn)
        log.info("Schema applied to %s", db_path)


_EXPECTED_COURSE_COLUMNS = {
    "tags_json": "TEXT",
    "warnings_json": "TEXT",
    "rules_json": "TEXT",
    "risk_level": "TEXT",
}


def _run_migrations(conn: sqlite3.Connection) -> None:
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(courses)").fetchall()}
    for col, col_type in _EXPECTED_COURSE_COLUMNS.items():
        if col not in existing:
            log.info("migration: adding column courses.%s %s", col, col_type)
            conn.execute(f"ALTER TABLE courses ADD COLUMN {col} {col_type}")


@contextmanager
def connect(db_path: Path = DB_PATH) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_courses(courses: Sequence[Course], db_path: Path = DB_PATH) -> int:
    """Insert or replace by (year, semester, course_code).

    Returns the number of rows written.
    """
    if not courses:
        return 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [_course_to_row(c, now) for c in courses]
    with connect(db_path) as conn:
        conn.executemany(_UPSERT_SQL, rows)
    return len(rows)


def record_scrape_run(
    *,
    year: int,
    semester: int,
    dept_code: str,
    dept_name: str | None,
    course_count: int,
    http_status: int | None,
    db_path: Path = DB_PATH,
) -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO scrape_runs
              (year, semester, dept_code, dept_name, course_count, http_status, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (year, semester, dept_code, dept_name, course_count, http_status, now),
        )


def known_dept_codes(year: int, semester: int, db_path: Path = DB_PATH) -> list[str]:
    with connect(db_path) as conn:
        cur = conn.execute(
            "SELECT DISTINCT dept_code FROM courses WHERE year=? AND semester=? ORDER BY dept_code",
            (year, semester),
        )
        return [r["dept_code"] for r in cur.fetchall() if r["dept_code"]]


# ---------------------------------------------------------------------------
# internals

_UPSERT_SQL = """
INSERT INTO courses (
  year, semester, course_code, course_name, course_name_en,
  required_or_elective, credits_raw, credits_lecture, credits_lab, credits_total,
  dept_code, dept_name,
  teachers_json,
  time_raw, time_slots_json,
  capacity, enrolled, remaining,
  raw_note, course_profile_id, scraped_at
) VALUES (
  :year, :semester, :course_code, :course_name, :course_name_en,
  :required_or_elective, :credits_raw, :credits_lecture, :credits_lab, :credits_total,
  :dept_code, :dept_name,
  :teachers_json,
  :time_raw, :time_slots_json,
  :capacity, :enrolled, :remaining,
  :raw_note, :course_profile_id, :scraped_at
)
ON CONFLICT (year, semester, course_code) DO UPDATE SET
  course_name          = excluded.course_name,
  course_name_en       = excluded.course_name_en,
  required_or_elective = excluded.required_or_elective,
  credits_raw          = excluded.credits_raw,
  credits_lecture      = excluded.credits_lecture,
  credits_lab          = excluded.credits_lab,
  credits_total        = excluded.credits_total,
  dept_code            = excluded.dept_code,
  dept_name            = excluded.dept_name,
  teachers_json        = excluded.teachers_json,
  time_raw             = excluded.time_raw,
  time_slots_json      = excluded.time_slots_json,
  capacity             = excluded.capacity,
  enrolled             = excluded.enrolled,
  remaining            = excluded.remaining,
  raw_note             = excluded.raw_note,
  course_profile_id    = excluded.course_profile_id,
  scraped_at           = excluded.scraped_at
"""


def _course_to_row(c: Course, scraped_at: str) -> dict:
    return {
        "year": c.year,
        "semester": c.semester,
        "course_code": c.course_code,
        "course_name": c.course_name,
        "course_name_en": c.course_name_en,
        "required_or_elective": c.required_or_elective,
        "credits_raw": c.credits_raw,
        "credits_lecture": c.credits_lecture,
        "credits_lab": c.credits_lab,
        "credits_total": c.credits_total,
        "dept_code": c.dept_code,
        "dept_name": c.dept_name,
        "teachers_json": json.dumps(
            [{"name": t.name, "slug": t.slug} for t in c.teachers],
            ensure_ascii=False,
        ),
        "time_raw": c.time_raw,
        "time_slots_json": json.dumps(
            [
                {
                    "weekday": s.weekday,
                    "periods": s.periods,
                    "classroom": s.classroom,
                }
                for s in c.time_slots
            ],
            ensure_ascii=False,
        ),
        "capacity": c.capacity,
        "enrolled": c.enrolled,
        "remaining": c.remaining,
        "raw_note": c.raw_note,
        "course_profile_id": c.course_profile_id,
        "scraped_at": scraped_at,
    }
