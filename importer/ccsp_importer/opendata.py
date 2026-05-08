"""Read the opendata 'list' CSV (Big5) just to harvest the dept-code index."""
from __future__ import annotations

import csv
import io
import logging
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
    reader = csv.DictReader(io.StringIO(csv_text))
    seen: dict[str, str] = {}
    code_field, name_field = _resolve_field_names(reader.fieldnames or [])
    for row in reader:
        code = (row.get(code_field) or "").strip()
        name = (row.get(name_field) or "").strip()
        if code and code not in seen:
            seen[code] = name
    entries = [DeptIndexEntry(dept_code=c, dept_name=n) for c, n in sorted(seen.items())]
    log.info("opendata index: %d unique dept codes", len(entries))
    return entries


def _resolve_field_names(fieldnames: Iterable[str]) -> tuple[str, str]:
    """The CSV header is in Chinese; resolve the two columns we care about."""
    code, name = None, None
    for fn in fieldnames:
        if fn == "開課系所代碼":
            code = fn
        elif fn == "開課系所名稱":
            name = fn
    if code is None or name is None:
        raise ValueError(
            f"opendata CSV missing dept columns; got header={list(fieldnames)!r}"
        )
    return code, name
