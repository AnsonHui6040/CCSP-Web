"""Plain dataclasses representing what we extract from /view-dept/ pages."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class Teacher:
    name: str
    slug: Optional[str]  # /view-teacher-profile/{slug}


@dataclass(frozen=True)
class TimeSlot:
    """One contiguous appearance of the course on the weekly grid.

    THU encodes class periods 1..14 with letter codes (A..D) for evening
    blocks; we store them as the strings shown on the site so we can
    round-trip the original notation.
    """

    weekday: int           # 1=Mon ... 7=Sun
    periods: List[str]     # e.g. ["7","8","9"] or ["A","B"]
    classroom: Optional[str]


@dataclass
class Course:
    year: int
    semester: int
    course_code: str
    course_name: str
    course_name_en: Optional[str] = None

    required_or_elective: Optional[str] = None
    credits_raw: Optional[str] = None
    credits_lecture: Optional[float] = None
    credits_lab: Optional[float] = None
    credits_total: Optional[float] = None

    dept_code: Optional[str] = None
    dept_name: Optional[str] = None

    teachers: List[Teacher] = field(default_factory=list)

    time_raw: Optional[str] = None
    time_slots: List[TimeSlot] = field(default_factory=list)

    capacity: Optional[int] = None
    enrolled: Optional[int] = None
    remaining: Optional[int] = None

    raw_note: Optional[str] = None
    course_profile_id: Optional[str] = None
