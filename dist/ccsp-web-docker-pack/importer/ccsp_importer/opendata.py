"""Read the opendata 'list' CSV (Big5) just to harvest the dept-code index."""
from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from .config import OPENDATA_ENCODING, OPENDATA_LIST_URL
from .http_client import PoliteSession

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeptIndexEntry:
    dept_code: str
    dept_name: str


def fetch_dept_index(
    *,
    year: int,
    semester: int,
    session: Optional[PoliteSession] = None,
    cache_path: Optional[Path] = None,
) -> List[DeptIndexEntry]:
    """Download the opendata CSV (or read from cache) and dedupe the dept list."""
    csv_text = _load_csv_text(
        year=year, semester=semester, session=session, cache_path=cache_path
    )
    return _parse_dept_index(csv_text)


# ---------------------------------------------------------------------------
# internals

def _load_csv_text(
    *,
    year: int,
    semester: int,
    session: Optional[PoliteSession],
    cache_path: Optional[Path],
) -> str:
    if cache_path is not None and cache_path.exists():
        log.info("Loading opendata CSV from cache %s", cache_path)
        return cache_path.read_text(encoding="utf-8")

    sess = session or PoliteSession()
    url = OPENDATA_LIST_URL.format(year=year, sem=semester)
    resp = sess.get(url)
    resp.raise_for_status()
    text = resp.content.decode(OPENDATA_ENCODING, errors="replace")
    if cache_path is not None:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(text, encoding="utf-8")
    return text


def _parse_dept_index(csv_text: str) -> List[DeptIndexEntry]:
    reader = csv.reader(io.StringIO(csv_text))
    seen: dict[str, str] = {}
    header = next(reader, None) or []
    code_idx, name_idx = _resolve_field_indexes(header)
    for row in reader:
        code, name = _dept_fields_from_row(row, code_idx=code_idx, name_idx=name_idx)
        if code and code not in seen:
            seen[code] = name
    entries = [DeptIndexEntry(dept_code=c, dept_name=n) for c, n in sorted(seen.items())]
    log.info("opendata index: %d unique dept codes", len(entries))
    return entries


def _resolve_field_indexes(fieldnames: Iterable[str]) -> tuple[int, int]:
    """The CSV header is in Chinese; resolve the two columns we care about."""
    code, name = None, None
    field_list = list(fieldnames)
    for i, fn in enumerate(field_list):
        if fn == "開課系所代碼":
            code = i
        elif fn == "開課系所名稱":
            name = i
    if code is None or name is None:
        raise ValueError(
            f"opendata CSV missing dept columns; got header={field_list!r}"
        )
    return code, name


_DEPT_CODE_RE = re.compile(r"^(?:\d{3}|[A-Z]\d{2})$")


def _dept_fields_from_row(row: list[str], *, code_idx: int, name_idx: int) -> tuple[str, str]:
    """Return dept fields, tolerating unquoted commas in the course name.

    The THU opendata export occasionally emits English course names containing
    commas without CSV quotes. The columns after course name are fixed, so when
    a row is wider than the header we recover dept_code/dept_name from the
    right-hand side instead of trusting shifted indexes.
    """
    if len(row) >= 9 and len(row) > name_idx + 4:
        code = row[-5].strip()
        name = row[-4].strip()
    else:
        code = row[code_idx].strip() if code_idx < len(row) else ""
        name = row[name_idx].strip() if name_idx < len(row) else ""

    if code and not _DEPT_CODE_RE.fullmatch(code):
        log.warning("Skipping malformed opendata dept code %r in row %r", code, row)
        return "", ""
    return code, name
