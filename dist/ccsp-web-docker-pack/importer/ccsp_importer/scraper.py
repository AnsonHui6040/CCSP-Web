"""Top-level orchestration: opendata index → /view-dept/ scrape → SQLite."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, Optional

from . import db, opendata
from .config import DATA_DIR, DEPT_LIST_URL
from .http_client import PoliteSession
from .parse_dept import parse_dept_page

log = logging.getLogger(__name__)


def scrape_semester(
    *,
    year: int,
    semester: int,
    only_dept_codes: Optional[Iterable[str]] = None,
    session: Optional[PoliteSession] = None,
    cache_dir: Optional[Path] = None,
) -> dict:
    """Scrape every department's course list for one semester.

    `only_dept_codes` lets the caller restrict the run (useful for smoke
    tests). `cache_dir` enables caching of fetched HTML to disk so we can
    re-parse without re-hitting the network.
    """
    session = session or PoliteSession()
    cache_dir = cache_dir or (DATA_DIR / "raw" / f"{year}-{semester}")
    cache_dir.mkdir(parents=True, exist_ok=True)

    db.init_db()

    index = opendata.fetch_dept_index(
        year=year,
        semester=semester,
        session=session,
        cache_path=cache_dir / "opendata.csv",
    )
    if only_dept_codes is not None:
        wanted = set(only_dept_codes)
        index = [e for e in index if e.dept_code in wanted]

    total_courses = 0
    failed: list[str] = []
    for i, entry in enumerate(index, start=1):
        log.info(
            "[%d/%d] dept=%s (%s)", i, len(index), entry.dept_code, entry.dept_name
        )
        try:
            courses = scrape_one_dept(
                year=year,
                semester=semester,
                dept_code=entry.dept_code,
                dept_name=entry.dept_name,
                session=session,
                cache_dir=cache_dir,
            )
        except Exception as exc:  # network / parse failures shouldn't kill the whole run
            log.warning("dept %s failed: %s", entry.dept_code, exc)
            failed.append(entry.dept_code)
            continue
        total_courses += len(courses)
    return {
        "year": year,
        "semester": semester,
        "departments_scraped": len(index) - len(failed),
        "departments_failed": failed,
        "courses_total": total_courses,
    }


def scrape_one_dept(
    *,
    year: int,
    semester: int,
    dept_code: str,
    dept_name: Optional[str],
    session: PoliteSession,
    cache_dir: Path,
) -> list:
    """Fetch a single dept page, parse it, and persist the results."""
    url = DEPT_LIST_URL.format(year=year, sem=semester, dept=dept_code)
    cache_file = cache_dir / f"dept-{dept_code}.html"
    if cache_file.exists():
        html = cache_file.read_text(encoding="utf-8")
        http_status = 200  # served from cache
    else:
        resp = session.get(url)
        http_status = resp.status_code
        resp.encoding = resp.apparent_encoding or "utf-8"
        html = resp.text
        if resp.status_code == 200:
            cache_file.write_text(html, encoding="utf-8")
        else:
            log.warning("dept %s returned HTTP %s", dept_code, resp.status_code)
            db.record_scrape_run(
                year=year,
                semester=semester,
                dept_code=dept_code,
                dept_name=dept_name,
                course_count=0,
                http_status=resp.status_code,
            )
            return []

    courses = parse_dept_page(
        html, year=year, semester=semester, dept_code=dept_code, dept_name=dept_name
    )
    if courses:
        db.upsert_courses(courses)
    db.record_scrape_run(
        year=year,
        semester=semester,
        dept_code=dept_code,
        dept_name=dept_name,
        course_count=len(courses),
        http_status=http_status,
    )
    return courses
