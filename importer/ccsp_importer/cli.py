"""Command-line entry point: `python -m ccsp_importer.cli ...`"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import List, Optional

from . import db, detail_scraper, note_runner, scraper


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

    p_sd = sub.add_parser(
        "scrape-details",
        help="fetch and parse per-course /view/{y}/{s}/{code} pages",
    )
    p_sd.add_argument("--year", type=int, required=True)
    p_sd.add_argument("--semester", type=int, required=True, choices=[1, 2])
    p_sd.add_argument(
        "--course",
        action="append",
        default=None,
        help="restrict to one course_code (can be repeated)",
    )
    p_sd.add_argument("--dept", default=None, help="restrict to one dept_code")
    p_sd.add_argument("--limit", type=int, default=None, help="cap number of courses processed")
    p_sd.add_argument(
        "--force",
        action="store_true",
        help="re-fetch even if course_details has fetch_status=success",
    )
    p_sd.add_argument(
        "--no-only-missing",
        dest="only_missing",
        action="store_false",
        default=True,
        help="disable the default skip-already-successful behaviour",
    )
    p_sd.add_argument(
        "--sleep",
        type=float,
        default=1.5,
        help="seconds between requests (default 1.5)",
    )
    cache_group = p_sd.add_mutually_exclusive_group()
    cache_group.add_argument(
        "--cache",
        dest="use_cache",
        action="store_true",
        default=True,
        help="cache fetched HTML in data/raw/{y}-{s}/details/ (default)",
    )
    cache_group.add_argument(
        "--no-cache",
        dest="use_cache",
        action="store_false",
        help="bypass disk cache; always re-fetch",
    )

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

    if args.cmd == "scrape-details":
        result = detail_scraper.scrape_details(
            year=args.year,
            semester=args.semester,
            only_courses=args.course,
            only_dept=args.dept,
            limit=args.limit,
            force=args.force,
            only_missing=args.only_missing,
            sleep_sec=args.sleep,
            use_cache=args.use_cache,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    parser.error(f"unknown command {args.cmd!r}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
