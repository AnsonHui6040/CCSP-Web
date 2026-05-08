"""Command-line entry point: `python -m ccsp_importer.cli ...`"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import List, Optional

from . import db, note_runner, scraper


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="ccsp_importer", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init-db", help="create SQLite schema if needed")

    p_scrape = sub.add_parser(
        "scrape", help="download dept-listing pages and write to SQLite"
    )
    p_scrape.add_argument("--year", type=int, required=True, help="學年, e.g. 114")
    p_scrape.add_argument("--semester", type=int, required=True, choices=[1, 2])
    p_scrape.add_argument(
        "--dept",
        action="append",
        default=None,
        help="restrict to one dept_code (can be repeated)",
    )

    p_pn = sub.add_parser(
        "parse-notes",
        help="parse raw_note → tags/warnings/rules/risk_level for one term",
    )
    p_pn.add_argument("--year", type=int, required=True)
    p_pn.add_argument("--semester", type=int, required=True, choices=[1, 2])

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.cmd == "init-db":
        db.init_db()
        print("OK: schema applied", file=sys.stderr)
        return 0

    if args.cmd == "scrape":
        result = scraper.scrape_semester(
            year=args.year,
            semester=args.semester,
            only_dept_codes=args.dept,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "parse-notes":
        result = note_runner.parse_notes_for_term(
            year=args.year, semester=args.semester
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    parser.error(f"unknown command {args.cmd!r}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
