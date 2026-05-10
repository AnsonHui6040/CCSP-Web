"""Parse a single course detail page (course.thu.edu.tw/view/{y}/{s}/{code}).

The page is a fixed sequence of `<h2 class="title">` sections inside
`#mainContent`. Multiple h2s sometimes share an outer `<div class="row">`
(e.g. 課程資訊, 參考書目, 開課紀錄 are siblings of the same row), so we
slice purely by *document order* between consecutive h2 elements rather
than using parent-row boundaries.

Strategy:
  1. Walk descendants of `#mainContent` once, splitting at every
     `<h2 class="title">`. Build `raw_sections = { name: text }`.
  2. Pull structured fields with targeted DOM queries (the grading table,
     the syllabus link) and regex over the raw section text (Office Hour,
     選課備註, teacher slugs).

Everything is allowed to be missing — the parser never throws on
incomplete pages. The `parser_version` in `config.py` lets re-runs
re-process cached HTML when this file evolves.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

from .config import BASE
from .models import Teacher

log = logging.getLogger(__name__)

# Footer h3 sections (關於課程資訊網, 站內連結, 聯絡我們) live OUTSIDE
# #mainContent so we don't actually have to filter them, but defensively:
_FOOTER_HEADINGS = {"關於課程資訊網", "站內連結", "聯絡我們"}


# ---------------------------------------------------------------------------
# Public API


def parse_course_detail(
    html: str,
    *,
    year: int,
    semester: int,
    course_code: str,
) -> dict:
    """Return the structured + raw view of one detail page."""
    soup = BeautifulSoup(html, "lxml")
    main = soup.select_one("#mainContent") or soup
    detail_url = f"{BASE}/view/{year}/{semester}/{course_code}"

    # The detail page uses `<br>` to separate label/value lines inside
    # `<p>` blocks. BeautifulSoup descendants don't yield whitespace for
    # void elements, so we normalize `<br>` to a literal newline before
    # any text extraction.
    for br in main.find_all("br"):
        br.replace_with("\n")

    raw_sections = _slice_sections(main)
    course_info_text = raw_sections.get("課程資訊", "")

    teaching_goal = _trim_or_none(raw_sections.get("教育目標"))
    # 課程概述 is sometimes absent — fall back to teaching_goal so the
    # detail page always has SOMETHING to show. Track them separately
    # though: callers may want to display only one.
    course_description = _trim_or_none(raw_sections.get("課程概述")) or teaching_goal
    reference_books = _trim_or_none(raw_sections.get("參考書目"))
    textbook = _trim_or_none(raw_sections.get("教材"))

    grading = _parse_grading_policy(main)
    syllabus_url = _extract_syllabus_url(main, detail_url)
    detailed_note = _extract_label_value(course_info_text, "選課備註")
    office_hour = _extract_office_hour(course_info_text)
    teachers = _extract_teachers(main)
    tas = _extract_tas(course_info_text)

    return {
        "detail_url": detail_url,
        "course_description": course_description,
        "teaching_goal": teaching_goal,
        "grading_policy": grading,
        "textbook": textbook,
        "reference_books": reference_books,
        "office_hour": office_hour,
        "syllabus_url": syllabus_url,
        "detailed_note": detailed_note,
        "teachers": [{"name": t.name, "slug": t.slug} for t in teachers],
        "teaching_assistants": tas,
        "raw_sections": raw_sections,
    }


# ---------------------------------------------------------------------------
# Section slicing
# ---------------------------------------------------------------------------


def _slice_sections(main: Tag) -> dict[str, str]:
    """Walk descendants once; build {section_name: text} by splitting on h2."""
    sections: dict[str, list[str]] = {}
    current_name: Optional[str] = None

    for el in main.descendants:
        if isinstance(el, Tag) and _is_section_h2(el):
            current_name = _heading_text(el)
            if current_name in _FOOTER_HEADINGS:
                current_name = None
                continue
            sections.setdefault(current_name, [])
            continue
        # Skip text inside an h2 itself (already accounted for as the heading).
        if isinstance(el, NavigableString):
            if current_name is None:
                continue
            parent = el.parent
            if parent is not None and _is_inside_section_heading(parent):
                continue
            sections[current_name].append(str(el))

    return {
        name: _normalize_text("".join(buf))
        for name, buf in sections.items()
        if buf
    }


def _is_section_h2(el: Tag) -> bool:
    if el.name != "h2":
        return False
    classes = el.get("class") or []
    return "title" in classes


_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def _is_inside_section_heading(node: Tag) -> bool:
    """Any h1-h6 ancestor — strips both top-level h2 markers AND inner
    h3 sub-headings (基本資料/教師與教學助理/授課大綱) so the resulting
    raw text is clean label-value lines we can regex over."""
    while node is not None and isinstance(node, Tag):
        if node.name in _HEADING_TAGS:
            return True
        node = node.parent  # type: ignore[assignment]
    return False


def _heading_text(h: Tag) -> str:
    span = h.find("span")
    text = span.get_text(" ", strip=True) if span else h.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_text(s: str) -> str:
    s = re.sub(r"[ \t ]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def _trim_or_none(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    return s or None


# ---------------------------------------------------------------------------
# Structured field extractors
# ---------------------------------------------------------------------------


def _parse_grading_policy(main: Tag) -> list[dict]:
    """Find the 評分方式 table (the only `aqua_table` whose first row
    has `<th>評分項目</th>`). Return list of `{item, percent, note}`.
    """
    for table in main.find_all("table", class_="aqua_table"):
        header = table.find("tr")
        if header is None:
            continue
        head_cells = [c.get_text(" ", strip=True) for c in header.find_all(["th", "td"])]
        if "評分項目" not in head_cells:
            continue
        out: list[dict] = []
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue
            item = cells[0].get_text(" ", strip=True)
            percent = _safe_float(cells[1].get_text(" ", strip=True))
            note = cells[2].get_text(" ", strip=True) if len(cells) >= 3 else ""
            if not item and percent is None:
                continue
            out.append(
                {
                    "item": item or None,
                    "percent": percent,
                    "note": note or None,
                }
            )
        return out
    return []


def _safe_float(s: str) -> Optional[float]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _extract_syllabus_url(main: Tag, base_url: str) -> Optional[str]:
    """The syllabus link is usually `desc.ithu.tw/{year}/{sem}/{code}`.
    Fall back to any anchor under any heading named "授課大綱" if the
    canonical pattern is missing (synthetic / shape-variant pages).

    Only http / https URLs are returned; any other scheme (javascript:,
    data:, file:, vbscript:, etc.) is discarded for safety.
    """
    def _safe(href: str) -> Optional[str]:
        resolved = urljoin(base_url, href)
        if urlparse(resolved).scheme in ("http", "https"):
            return resolved
        return None

    for a in main.find_all("a", href=True):
        href = a["href"].strip()
        if "desc.ithu.tw" in href:
            return _safe(href)
    for h in main.find_all(_HEADING_TAGS):
        if _heading_text(h) != "授課大綱":
            continue
        # Look at the immediate parent block for an <a>; that's where the
        # template puts it on the real page.
        parent = h.find_parent()
        if parent is None:
            continue
        a = parent.find("a", href=True)
        if a:
            return _safe(a["href"].strip())
    return None


def _extract_teachers(main: Tag) -> list[Teacher]:
    """Collect every distinct teacher-profile anchor anywhere on the page."""
    seen: dict[str, Teacher] = {}
    for a in main.find_all("a", href=re.compile(r"/view-teacher-profile/")):
        m = re.search(r"/view-teacher-profile/([^/?#]+)", a.get("href", ""))
        slug = m.group(1) if m else None
        name = a.get_text(strip=True)
        if not name:
            continue
        key = slug or name
        if key not in seen:
            seen[key] = Teacher(name=name, slug=slug)
    return list(seen.values())


# Lines that, when seen at the start of a new line, end the current
# label's value. Includes section headings and common labels that don't
# always have a colon (e.g. "Office Hour" sometimes lacks one in the
# detail page output).
_VALUE_STOP_RE = (
    r"(?=\n\s*(?:授課教師|授課大綱|選課備註|修課班級|修課年級|學分數|"
    r"上課時間|大班TA|教學助理|Office\s*Hour|教育目標|課程概述|"
    r"參考書目|開課紀錄|評分方式|選課分析|本學期)|\Z)"
)

_LABEL_LINE_RE_CACHE: dict[str, re.Pattern] = {}


def _extract_label_value(text: str, label: str) -> Optional[str]:
    """Pull `{label}：value` from a multiline body, stopping at the next
    known label or section heading."""
    if not text:
        return None
    pat = _LABEL_LINE_RE_CACHE.get(label)
    if pat is None:
        pat = re.compile(
            rf"{re.escape(label)}\s*[：:]\s*(.+?){_VALUE_STOP_RE}",
            re.DOTALL,
        )
        _LABEL_LINE_RE_CACHE[label] = pat
    m = pat.search(text)
    return _trim_or_none(m.group(1)) if m else None


_OFFICE_HOUR_RE = re.compile(
    rf"Office\s*Hour\s*[:：]?\s*(.+?){_VALUE_STOP_RE}",
    re.DOTALL | re.IGNORECASE,
)


def _extract_office_hour(text: str) -> Optional[str]:
    if not text:
        return None
    m = _OFFICE_HOUR_RE.search(text)
    if not m:
        return None
    val = m.group(1).strip()
    return val or None


_TA_LABEL_RE = re.compile(
    rf"(?:大班TA(?:或教學助理)?|教學助理)\s*[:：]\s*([^\n]+)"
)


def _extract_tas(text: str) -> list[dict]:
    if not text:
        return []
    m = _TA_LABEL_RE.search(text)
    if not m:
        return []
    raw = m.group(1).strip()
    if not raw or raw in {"尚無資料", "無", "未定"}:
        return []
    parts = re.split(r"[、,，;；\n]+", raw)
    return [{"name": p.strip()} for p in parts if p.strip()]
