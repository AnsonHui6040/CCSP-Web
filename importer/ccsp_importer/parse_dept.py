"""HTML parser for /view-dept/{year}/{sem}/{dept_code}/ pages.

The page renders a `<table class="aqua_table">` with one `<tr>` per course,
each `<td>` annotated with `data-title="..."` that we can rely on as a
selector. We extract cell text, then run small regexes to lift structured
fields out of the visible Chinese strings.
"""
from __future__ import annotations

import logging
import re
from typing import Iterable, List, Optional

from bs4 import BeautifulSoup, Tag

from .models import Course, Teacher, TimeSlot

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API

def parse_dept_page(
    html: str,
    *,
    year: int,
    semester: int,
    dept_code: str,
    dept_name: Optional[str] = None,
) -> List[Course]:
    """Extract every course row on a /view-dept/ page."""
    soup = BeautifulSoup(html, "lxml")
    courses: list[Course] = []

    # Course rows are uniquely identifiable by having a td with
    # data-title="選課代碼". We scan globally so the parser works even if
    # the page layout adds wrapping sections.
    code_tds = soup.find_all("td", attrs={"data-title": "選課代碼"})
    for code_td in code_tds:
        tr = code_td.find_parent("tr")
        if tr is None:
            continue
        course = _row_to_course(
            tr,
            year=year,
            semester=semester,
            dept_code=dept_code,
            dept_name=dept_name,
        )
        if course is not None:
            courses.append(course)
    log.debug("parsed %d courses from dept %s", len(courses), dept_code)
    return courses


# ---------------------------------------------------------------------------
# Row parsing

def _row_to_course(
    tr: Tag,
    *,
    year: int,
    semester: int,
    dept_code: str,
    dept_name: Optional[str],
) -> Optional[Course]:
    cells = {td.get("data-title"): td for td in tr.find_all("td", attrs={"data-title": True})}

    code = _clean(cells.get("選課代碼"))
    if not code:
        return None

    name_zh, name_en, prefix = _split_name(cells.get("課程名稱"))
    credits_raw = _clean(cells.get("學分數"))
    lec, lab, total = _parse_credits(credits_raw)
    time_raw = _normalise_time_text(cells.get("時間地點"))
    if time_raw == "無資料":
        time_raw = None
    time_slots = _parse_time_slots(time_raw)
    teachers = _parse_teachers(cells.get("授課教師"))
    cap, enr, rem = _parse_enrollment(cells.get("人數狀態"))
    raw_note, profile_id = _parse_note(cells.get("備註"))

    return Course(
        year=year,
        semester=semester,
        course_code=code,
        course_name=name_zh,
        course_name_en=name_en,
        required_or_elective=prefix,
        credits_raw=credits_raw,
        credits_lecture=lec,
        credits_lab=lab,
        credits_total=total,
        dept_code=dept_code,
        dept_name=dept_name,
        teachers=teachers,
        time_raw=time_raw,
        time_slots=time_slots,
        capacity=cap,
        enrolled=enr,
        remaining=rem,
        raw_note=raw_note,
        course_profile_id=profile_id,
    )


# ---------------------------------------------------------------------------
# Field-level helpers

_BR_RE = re.compile(r"<\s*br\s*/?\s*>", re.IGNORECASE)


def _clean(td: Optional[Tag]) -> Optional[str]:
    if td is None:
        return None
    text = td.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text or None


def _split_name(td: Optional[Tag]) -> tuple[str, Optional[str], Optional[str]]:
    """Parse "選修-口述歷史製作<BR>Making Oral History" into (zh, en, prefix)."""
    if td is None:
        return "", None, None
    # Replace <br> with a separator we can split on, then collapse whitespace.
    html = str(td)
    html = _BR_RE.sub("\n", html)
    text = BeautifulSoup(html, "lxml").get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "", None, None
    head = lines[0]
    en = " ".join(lines[1:]) if len(lines) > 1 else None
    prefix, _, zh = head.partition("-")
    if not zh:
        # No prefix; the whole head is the name.
        return head, en, None
    return zh.strip(), en, prefix.strip() or None


_CREDITS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)")


def _parse_credits(raw: Optional[str]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    if not raw:
        return None, None, None
    m = _CREDITS_RE.search(raw)
    if not m:
        # Sometimes a single number — treat as total lecture.
        try:
            n = float(raw.strip())
        except ValueError:
            return None, None, None
        return n, None, n
    lec = float(m.group(1))
    lab = float(m.group(2))
    return lec, lab, lec + lab


def _normalise_time_text(td: Optional[Tag]) -> Optional[str]:
    if td is None:
        return None
    # The site sometimes outputs an unmatched </a> at the end of the cell;
    # get_text strips it.
    text = td.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text or None


_WEEKDAY_MAP = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7}
_WEEKDAY_CHARS = "一二三四五六日天"

# Outer blocks are introduced by `星期` and may contain multiple days that
# share one classroom (Format B). Splitting on the lookahead keeps each
# block's content together.
_BLOCK_SPLIT_RE = re.compile(r"\s*(?=星期)")
# A trailing `[ROOM]` (optional) — captured greedy from the end so room
# strings containing brackets stay intact.
_ROOM_RE = re.compile(r"\[([^\]]+)\]\s*$")
# Inside a block body, sub-slots after the first day are introduced by
# `,X/` where X is a weekday character.
_INNER_SPLIT_RE = re.compile(rf",(?=[{_WEEKDAY_CHARS}]/)")
_DAY_HEAD_RE = re.compile(rf"([{_WEEKDAY_CHARS}])/(.+)")


def _parse_time_slots(time_raw: Optional[str]) -> List[TimeSlot]:
    """Parse the THU 時間地點 string into structured TimeSlot list.

    Supports both observed formats:
      A) `星期一/3,4[H101] 星期三/5,6[H102]`   — separate blocks, separate rooms
      B) `星期一/3,4,二/3,4[H305]`             — one block, multiple days, shared room
      Mixed: `星期一/3,4,二/3,4[H305] 星期五/7[H103]`
    """
    if not time_raw:
        return []
    slots: list[TimeSlot] = []
    for block in _BLOCK_SPLIT_RE.split(time_raw):
        if not block.startswith("星期"):
            continue
        body = block[len("星期"):].strip()
        if not body:
            continue
        room_m = _ROOM_RE.search(body)
        classroom = room_m.group(1).strip() if room_m else None
        body_no_room = body[: room_m.start()].rstrip(", ") if room_m else body
        for sub in _INNER_SPLIT_RE.split(body_no_room):
            sub = sub.strip().rstrip(",")
            if not sub:
                continue
            head = _DAY_HEAD_RE.match(sub)
            if not head:
                continue
            weekday = _WEEKDAY_MAP.get(head.group(1))
            if weekday is None:
                continue
            periods = [p.strip() for p in head.group(2).split(",") if p.strip()]
            if not periods:
                continue
            slots.append(
                TimeSlot(weekday=weekday, periods=periods, classroom=classroom)
            )
    return slots


def _parse_teachers(td: Optional[Tag]) -> List[Teacher]:
    if td is None:
        return []
    teachers: list[Teacher] = []
    for a in td.find_all("a"):
        href = a.get("href") or ""
        m = re.search(r"/view-teacher-profile/([^/?#]+)", href)
        slug = m.group(1) if m else None
        name = a.get_text(strip=True)
        if name:
            teachers.append(Teacher(name=name, slug=slug))
    if not teachers:
        # Fallback: plain text only, no anchors.
        text = td.get_text(" ", strip=True)
        if text:
            teachers.append(Teacher(name=text, slug=None))
    return teachers


_CAP_RE = re.compile(r"上限\s*(\d+)")
_ENR_RE = re.compile(r"現選\s*(\d+)")
_REM_RE = re.compile(r"餘額\s*(\d+)")


def _parse_enrollment(
    td: Optional[Tag],
) -> tuple[Optional[int], Optional[int], Optional[int]]:
    if td is None:
        return None, None, None
    text = td.get_text(" ", strip=True)
    cap = _int_or_none(_CAP_RE.search(text))
    enr = _int_or_none(_ENR_RE.search(text))
    rem = _int_or_none(_REM_RE.search(text))
    return cap, enr, rem


def _int_or_none(m: Optional[re.Match]) -> Optional[int]:
    return int(m.group(1)) if m else None


def _parse_note(td: Optional[Tag]) -> tuple[Optional[str], Optional[str]]:
    """Return (raw_note, course_profile_id).

    The 備註 cell starts with a small `<a href="/course-profile/{id}">{id}</a>`
    that links to the historical record; we capture that id and remove it
    from the human-readable note text.
    """
    if td is None:
        return None, None
    profile_id: Optional[str] = None
    profile_link = td.find("a", href=re.compile(r"/course-profile/"))
    if profile_link is not None:
        m = re.search(r"/course-profile/(\d+)", profile_link.get("href", ""))
        if m:
            profile_id = m.group(1)
        profile_link.extract()
    # Drop the dept link (it's just the same dept we're currently scraping).
    for a in td.find_all("a", href=re.compile(r"/view-dept/")):
        a.extract()
    text = td.get_text("\n", strip=True)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    # The cell template is `{profile_link} {dept_link} / {note}`; with both
    # anchors stripped, a stray leading "/" separator is what remains.
    text = re.sub(r"^[/\s]+", "", text)
    return (text or None), profile_id
