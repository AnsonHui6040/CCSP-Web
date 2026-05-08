"""Tests for ccsp_importer.parse_detail.

Run from repo root:
    python -m pytest importer/tests/test_parse_detail.py -q
"""
from __future__ import annotations

from pathlib import Path

import pytest

from ccsp_importer.parse_detail import parse_course_detail

FIXTURES = Path(__file__).parent / "fixtures"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# 1. tolerance to bad/empty input

def test_empty_html_does_not_crash():
    r = parse_course_detail("", year=114, semester=1, course_code="0000")
    assert r["detail_url"].endswith("/0000")
    assert r["course_description"] is None
    assert r["teaching_goal"] is None
    assert r["grading_policy"] == []
    assert r["raw_sections"] == {}


def test_garbage_html_does_not_crash():
    html = "<html><body><p>just a stray paragraph with no headings</p></body></html>"
    r = parse_course_detail(html, year=114, semester=1, course_code="0000")
    assert r["course_description"] is None
    assert r["raw_sections"] == {}


def test_missing_section_does_not_crash():
    """Page that has 評分方式 but lacks 教育目標/課程概述/參考書目."""
    html = """
    <html><body><div id="mainContent">
      <h2 class="title"><span>評分方式</span></h2>
      <table class="aqua_table">
        <tr><th>評分項目</th><th>配分比例</th><th>說明</th></tr>
        <tr><td>出席</td><td>20</td><td></td></tr>
      </table>
    </div></body></html>
    """
    r = parse_course_detail(html, year=114, semester=1, course_code="9999")
    assert r["grading_policy"] == [{"item": "出席", "percent": 20.0, "note": None}]
    assert r["teaching_goal"] is None
    assert r["course_description"] is None
    assert r["reference_books"] is None


# ---------------------------------------------------------------------------
# 2. structured field extraction (real fixture: 0001)

def test_grading_policy_extracts_from_table():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["grading_policy"] == [
        {"item": "出席", "percent": 20.0, "note": None},
        {"item": "口頭報告", "percent": 60.0, "note": None},
        {"item": "發表與評鑑", "percent": 20.0, "note": None},
    ]


def test_teaching_goal_and_description_present():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["teaching_goal"] is not None
    assert "口述歷史" in r["teaching_goal"] or "史學" in r["teaching_goal"]
    assert r["course_description"] is not None


def test_reference_books_extracts_from_section():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["reference_books"] is not None
    assert "口述史研究方法" in r["reference_books"]


def test_office_hour_extracts_lines():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["office_hour"] is not None
    # Should NOT contain the next h3 / known-label noise
    assert "授課大綱" not in r["office_hour"]
    assert "大班TA" not in r["office_hour"]
    assert r["office_hour"].startswith("上課討論")


def test_detailed_note_isolated_from_other_lines():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["detailed_note"] == "文創學程選修"


def test_syllabus_url_absolute():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["syllabus_url"] == "http://desc.ithu.tw/114/1/0001"


def test_syllabus_relative_link_becomes_absolute():
    """Synthetic page where the syllabus link is given as a relative path."""
    html = """
    <html><body><div id="mainContent">
      <h2 class="title"><span>課程資訊</span></h2>
      <p><a href="/foo/bar/baz">syllabus</a></p>
      <h2 class="title"><span>授課大綱</span></h2>
      <p><a href="/relative/syllabus/path">link</a></p>
    </div></body></html>
    """
    r = parse_course_detail(html, year=114, semester=1, course_code="0001")
    # No desc.ithu.tw, so falls back to the 授課大綱 anchor; should be absolute
    assert r["syllabus_url"] is not None
    assert r["syllabus_url"].startswith("https://course.thu.edu.tw/")


def test_teachers_with_slugs():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    slugs = sorted(t["slug"] for t in r["teachers"] if t.get("slug"))
    assert slugs == ["echiu", "ytsung"]


def test_tas_returns_empty_when_marker_absent():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    assert r["teaching_assistants"] == []


# ---------------------------------------------------------------------------
# 3. real fixture: 1752 (different shape — no 課程概述)

def test_1752_handles_missing_course_description_section():
    r = parse_course_detail(
        _read("detail_1752.html"), year=114, semester=1, course_code="1752"
    )
    # 1752 has 教育目標 but NO separate 課程概述 — fallback fills both fields
    assert r["teaching_goal"] is not None
    assert "資料" in r["teaching_goal"]
    assert r["course_description"] == r["teaching_goal"]
    # 1752 grading total = 100
    assert sum(g["percent"] for g in r["grading_policy"]) == 100
    # Office Hour is just "五/8"
    assert r["office_hour"] == "五/8"
    # Single teacher
    assert len(r["teachers"]) == 1
    assert r["teachers"][0]["slug"] == "steve312kimo"


# ---------------------------------------------------------------------------
# 4. raw_sections preservation

def test_raw_sections_keeps_every_section_text():
    r = parse_course_detail(
        _read("detail_0001.html"), year=114, semester=1, course_code="0001"
    )
    # Spec §  4: must preserve raw section text (used for re-parsing later).
    assert "評分方式" in r["raw_sections"]
    assert "教育目標" in r["raw_sections"]
    assert "課程資訊" in r["raw_sections"]
    assert "參考書目" in r["raw_sections"]
    # Footer headings (lives outside #mainContent) should NOT appear
    assert "關於課程資訊網" not in r["raw_sections"]
    assert "聯絡我們" not in r["raw_sections"]


# ---------------------------------------------------------------------------
# 5. HTML-shape variant tolerance

def test_handles_minimal_h2_only_layout():
    """Some pages may have h2 sections without the surrounding row wrapper."""
    html = """
    <html><body><div id="mainContent">
      <h2 class="title"><span>教育目標</span></h2>
      <p>培養某某某能力。</p>
      <h2 class="title"><span>參考書目</span></h2>
      <p>無</p>
    </div></body></html>
    """
    r = parse_course_detail(html, year=114, semester=1, course_code="X")
    assert r["teaching_goal"] == "培養某某某能力。"
    assert r["reference_books"] == "無"


def test_grading_table_with_decimals_and_unicode_content():
    html = """
    <html><body><div id="mainContent">
      <h2 class="title"><span>評分方式</span></h2>
      <table class="aqua_table">
        <tr><th>評分項目</th><th>配分比例</th><th>說明</th></tr>
        <tr><td>期中考</td><td>33.3</td><td>含口試</td></tr>
        <tr><td>期末考</td><td>66.7</td><td></td></tr>
      </table>
    </div></body></html>
    """
    r = parse_course_detail(html, year=114, semester=1, course_code="X")
    assert r["grading_policy"] == [
        {"item": "期中考", "percent": 33.3, "note": "含口試"},
        {"item": "期末考", "percent": 66.7, "note": None},
    ]
