"""Bulk-parse raw_note for an existing semester and write back the
structured columns (tags_json / warnings_json / rules_json / risk_level).

Idempotent — re-running with the same input produces the same output.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Optional

from . import db
from .config import DB_PATH
from .note_parser import TAG_DEFS_BY_KEY, parse_note

log = logging.getLogger(__name__)


def parse_notes_for_term(
    *,
    year: int,
    semester: int,
    sample_per_tag: int = 2,
    db_path: Path = DB_PATH,
) -> dict:
    """Parse every course's raw_note for the given term and persist results.

    Returns a stats dict shaped per the Phase-2 spec:
      total_courses, courses_with_tags, courses_with_warnings,
      high/medium/low_risk_count, tag_distribution, warning_distribution,
      top_raw_note_samples_by_tag.
    """
    db.init_db(db_path)  # ensure migration columns exist

    tag_counter: Counter[str] = Counter()
    risk_counter: Counter[str] = Counter()
    samples_by_tag: dict[str, list[dict]] = {k: [] for k in TAG_DEFS_BY_KEY}
    courses_with_tags = 0

    with db.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, course_code, course_name, raw_note
                 FROM courses
                WHERE year = ? AND semester = ?""",
            (year, semester),
        ).fetchall()

        update = conn.cursor()
        total = len(rows)
        for row in rows:
            result = parse_note(row["raw_note"])
            update.execute(
                """UPDATE courses
                      SET tags_json     = ?,
                          warnings_json = ?,
                          rules_json    = ?,
                          risk_level    = ?
                    WHERE id = ?""",
                (
                    json.dumps(result["tags"], ensure_ascii=False),
                    json.dumps(result["warnings"], ensure_ascii=False),
                    json.dumps(result["rules"], ensure_ascii=False),
                    result["risk_level"],
                    row["id"],
                ),
            )

            if result["tags"]:
                courses_with_tags += 1
            risk_counter[result["risk_level"]] += 1
            for t in result["tags"]:
                tag_counter[t] += 1
                if len(samples_by_tag[t]) < sample_per_tag:
                    samples_by_tag[t].append(
                        {
                            "course_code": row["course_code"],
                            "course_name": row["course_name"],
                            "raw_note": row["raw_note"],
                        }
                    )

    return {
        "term": {"year": year, "semester": semester},
        "total_courses": total,
        "courses_with_tags": courses_with_tags,
        "courses_with_warnings": courses_with_tags,  # 1:1 in current model
        "high_risk_count": risk_counter.get("high", 0),
        "medium_risk_count": risk_counter.get("medium", 0),
        "low_risk_count": risk_counter.get("low", 0),
        "tag_distribution": _ordered_distribution(tag_counter),
        "warning_distribution": _ordered_distribution(tag_counter),  # mirrors tags
        "top_raw_note_samples_by_tag": {
            k: v for k, v in samples_by_tag.items() if v
        },
    }


def _ordered_distribution(counter: Counter[str]) -> list[dict]:
    """Tag → {key, display, level, count}, ordered by TAG_DEFS priority."""
    out: list[dict] = []
    for key, td in TAG_DEFS_BY_KEY.items():
        out.append(
            {
                "key": key,
                "display": td.display,
                "level": td.level,
                "count": counter.get(key, 0),
            }
        )
    return out
