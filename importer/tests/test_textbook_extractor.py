"""Tests for ccsp_importer.textbook_extractor.

Run from repo root:
    python -m pytest importer/tests/test_textbook_extractor.py -q
"""
from __future__ import annotations

import pytest

from ccsp_importer.textbook_extractor import extract_textbook

# ---------------------------------------------------------------------------
# Helper


def _d(
    reference_books: str | None = None,
    teaching_goal: str | None = None,
    course_description: str | None = None,
    raw_sections_json: str | None = None,
) -> dict:
    """Build a minimal detail dict for testing."""
    return {
        "reference_books": reference_books,
        "teaching_goal": teaching_goal,
        "course_description": course_description,
        "raw_sections_json": raw_sections_json,
        "textbook": None,
    }


# ---------------------------------------------------------------------------
# 1. Robustness — empty / None input


def test_empty_detail_dict_returns_none():
    assert extract_textbook({}) is None


def test_all_fields_none_returns_none():
    assert extract_textbook(_d()) is None


def test_empty_string_fields_return_none():
    assert extract_textbook(_d(reference_books="", teaching_goal="")) is None


# ---------------------------------------------------------------------------
# 2. Chinese colon-keyword patterns


def test_bare_textbook_keyword_zh():
    result = extract_textbook(_d(reference_books="教材：管理學原理"))
    assert result == "管理學原理"


def test_specified_textbook_keyword_zh():
    result = extract_textbook(_d(reference_books="指定教材：統計學"))
    assert result == "統計學"


def test_main_textbook_keyword_zh():
    result = extract_textbook(_d(reference_books="主要教材：\n\n王建勤，《第二語言習得研究》"))
    assert result == "王建勤，《第二語言習得研究》"


def test_use_textbook_keyword_zh():
    result = extract_textbook(_d(reference_books="使用教材：自編講義"))
    assert result == "自編講義"


# ---------------------------------------------------------------------------
# 3. English colon-keyword patterns


def test_textbook_colon_en():
    result = extract_textbook(_d(reference_books="Textbook: Statistics 101"))
    assert result == "Statistics 101"


def test_required_textbook_en():
    result = extract_textbook(_d(reference_books="Required Textbook: Applied Mathematics"))
    assert result == "Applied Mathematics"


def test_required_text_en():
    result = extract_textbook(_d(reference_books="Required Text: Linear Algebra by Strang"))
    assert result == "Linear Algebra by Strang"


# ---------------------------------------------------------------------------
# 4. Multi-line extraction with stop labels


def test_multiline_stops_at_reference_books_label():
    rb = (
        "主要教材：\n\n"
        "自編講義\n\n"
        "參考書籍：\n"
        "吳功正主編：《古文鑑賞集成》，台北：文史哲。"
    )
    result = extract_textbook(_d(reference_books=rb))
    assert result == "自編講義"


def test_multiline_stops_at_main_reference_label():
    rb = (
        "教材：黃錦鈜：《新譯莊子讀本》，台北：三民書局。\n\n"
        "主要參考書：\n"
        "1.陳鼓應：《莊子今註今譯》，台北：臺灣商務印書館。"
    )
    result = extract_textbook(_d(reference_books=rb))
    assert result == "黃錦鈜：《新譯莊子讀本》，台北：三民書局。"


def test_multiline_stops_at_reference_list_label():
    rb = (
        "主要教材：\n\n"
        "王建勤（2009），《第二語言習得研究》，北京：商務印書館。\n\n"
        "參考書目：\n\n"
        "趙楊（2015），《第二語言習得研究》。"
    )
    result = extract_textbook(_d(reference_books=rb))
    assert result == "王建勤（2009），《第二語言習得研究》，北京：商務印書館。"


# ---------------------------------------------------------------------------
# 5. "No textbook" detection


def test_no_textbook_zh():
    result = extract_textbook(_d(reference_books="無指定教材"))
    assert result == "無指定教材"


def test_no_textbook_en():
    result = extract_textbook(_d(reference_books="No textbook required"))
    assert result == "無指定教材"


def test_no_textbook_en_simple():
    result = extract_textbook(_d(reference_books="No textbook"))
    assert result == "無指定教材"


# ---------------------------------------------------------------------------
# 6. Standalone handout markers


def test_standalone_handout_zibianjiangyi():
    result = extract_textbook(_d(reference_books="自編講義"))
    assert result == "自編講義"


def test_standalone_handout_teacher_authored():
    result = extract_textbook(_d(reference_books="教師自編講義"))
    assert result == "教師自編講義"


def test_standalone_handout_with_punctuation():
    result = extract_textbook(_d(reference_books="教師自編講義。"))
    assert result == "教師自編講義"


def test_standalone_lecture_notes_only():
    """reference_books = '講義' alone should be recognized."""
    result = extract_textbook(_d(reference_books="講義"))
    assert result == "講義"


# ---------------------------------------------------------------------------
# 7. Plain reference list with no keyword → do NOT extract


def test_plain_reference_list_not_extracted():
    rb = (
        "李向平、魏揚波著，《口述史研究方法》，上海：上海人民出版社，2010年4月。\n\n"
        "楊祥銀，《與歷史對話：口述史學的理論與實踐》，北京：中國社會科學出版社，2004。"
    )
    assert extract_textbook(_d(reference_books=rb)) is None


def test_single_book_citation_not_extracted():
    assert extract_textbook(_d(reference_books="依照不同實習單位提供參考書目。")) is None


# ---------------------------------------------------------------------------
# 8. Length guard — suspicious long extraction → None


def test_too_long_extraction_returns_none():
    # Keyword followed by >1000 chars of text → rejected
    long_text = "A" * 1001
    rb = f"教材：{long_text}"
    assert extract_textbook(_d(reference_books=rb)) is None


def test_exactly_max_length_returns_none():
    # 1000 chars is the limit; >1000 → None
    rb = "教材：" + "X" * 1001
    assert extract_textbook(_d(reference_books=rb)) is None


# ---------------------------------------------------------------------------
# 9. raw_sections_json priority


def test_raw_sections_json_textbook_section_wins():
    import json
    sections = {
        "參考書目": "大量書單...",
        "教材": "《統計學》by John Freund",
    }
    d = _d(
        reference_books="大量書單...",
        raw_sections_json=json.dumps(sections, ensure_ascii=False),
    )
    result = extract_textbook(d)
    assert result == "《統計學》by John Freund"


# ---------------------------------------------------------------------------
# 10. Fallback to teaching_goal


def test_teaching_goal_fallback_when_reference_books_has_no_keyword():
    d = _d(
        reference_books="李向平著，《口述史方法》。",
        teaching_goal="Textbook: Introduction to Linguistics",
    )
    assert extract_textbook(d) == "Introduction to Linguistics"


# ---------------------------------------------------------------------------
# 11. Chinese-English mixed content


def test_chinese_english_mixed():
    rb = "教材：Organic Chemistry 8th ed. by Paula Y. Bruice (自編補充講義)"
    result = extract_textbook(_d(reference_books=rb))
    assert result == "Organic Chemistry 8th ed. by Paula Y. Bruice (自編補充講義)"


# ---------------------------------------------------------------------------
# 12. Supplementary materials label is a STOP label, not a trigger


def test_supplementary_materials_does_not_trigger():
    """補充教材 should be treated as a stop label, not extract its content."""
    rb = (
        "李子瑄（2010）。《漢語語言學》。\n"
        "鄭縈（2012）《華語句法新論》。\n\n"
        "補充教材：\n"
        "1. 邵敬敏《現代漢語通論》。"
    )
    # No intro keyword → entire block should not be extracted
    assert extract_textbook(_d(reference_books=rb)) is None


# ---------------------------------------------------------------------------
# 13. Real-data samples


def test_real_data_code_0004():
    """reference_books = '教師自編講義' → should extract."""
    assert extract_textbook(_d(reference_books="教師自編講義")) == "教師自編講義"


def test_real_data_code_0543():
    """教材：使用自編講義 → should extract '使用自編講義'."""
    rb = (
        "教材：使用自編講義\n\n"
        "參考書：\n"
        "1. Organic Chemistry, 8th ed. by Paula Y. Bruice, 2017."
    )
    result = extract_textbook(_d(reference_books=rb))
    assert result == "使用自編講義"


def test_real_data_code_0031():
    """主要教材 followed by standalone 自編講義 then 參考書籍 stop."""
    rb = (
        "主要教材：\n\n"
        "自編講義\n\n"
        "參考書籍：\n\n"
        "吳功正主編：《古文鑑賞集成》，台北：文史哲。"
    )
    result = extract_textbook(_d(reference_books=rb))
    assert result == "自編講義"
