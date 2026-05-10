"""Tests for ccsp_importer.note_parser.

Run from repo root:
    python -m pytest importer/tests -q
"""
from __future__ import annotations

import pytest

from ccsp_importer.note_parser import parse_note


# ---------------------------------------------------------------------------
# Helpers


def keys(result: dict) -> list[str]:
    return result["tags"]


def levels(result: dict) -> list[str]:
    return [w["level"] for w in result["warnings"]]


# ---------------------------------------------------------------------------
# 1. empty / whitespace inputs


@pytest.mark.parametrize("raw", [None, "", "   ", "\n\t  "])
def test_empty_input_returns_low_risk_with_no_tags(raw):
    r = parse_note(raw)
    assert r == {
        "tags": [],
        "warnings": [],
        "rules": [],
        "risk_level": "low",
    }


# ---------------------------------------------------------------------------
# 2. single-tag detections


def test_no_online_selection():
    r = parse_note("本課程不開放網路選課，請洽系辦")
    assert "online_selection_unavailable" in keys(r)
    assert "manual_selection_required" in keys(r)
    assert r["risk_level"] == "high"


def test_manual_selection():
    r = parse_note("採人工加選")
    assert keys(r) == ["manual_selection_required"]
    assert r["risk_level"] == "medium"


def test_restricted_foreign_students():
    r = parse_note("限外國學生")
    assert "restricted" in keys(r)
    assert r["risk_level"] == "high"
    assert any(
        rule["value"] == "限外國學生" and rule["type"] == "restriction"
        for rule in r["rules"]
    )


def test_english_taught_chinese_keyword():
    r = parse_note("本課程全英文授課")
    assert keys(r) == ["english_taught"]
    assert r["risk_level"] == "low"


def test_english_taught_emi_word_boundary():
    # "EMI" as standalone English token
    r = parse_note("This course is taught in English (EMI).")
    assert "english_taught" in keys(r)


def test_english_taught_does_not_match_random_emi_substring():
    # "EMIly" should NOT trigger — \b boundary
    r = parse_note("The professor's name is EMIly.")
    assert "english_taught" not in keys(r)


def test_remote_teaching():
    r = parse_note("本課程為遠距教學，使用 Google Meet")
    # Both keyword families match but only one tag is added.
    assert keys(r) == ["remote"]


def test_not_count_graduation():
    r = parse_note("本課程學分不計入畢業學分")
    assert "not_count_graduation" in keys(r)
    assert r["risk_level"] == "high"


def test_not_count_gpa_variants():
    for note in [
        "本課程不列入學期學業平均成績",
        "成績不列入平均",
        "不計GPA",
        "不列 GPA",
        "不計入 GPA",
    ]:
        r = parse_note(note)
        assert "not_count_gpa" in keys(r), note


def test_placement_test():
    r = parse_note("修課前需參加分級測驗")
    assert "placement_test_required" in keys(r)


def test_micro_credit():
    r = parse_note("本課程為微學分課程")
    assert "micro_credit" in keys(r)


def test_irregular_schedule_intensive():
    r = parse_note("密集授課，上課時間另訂")
    assert "irregular_schedule" in keys(r)
    assert r["risk_level"] == "medium"


# ---------------------------------------------------------------------------
# 3. multi-tag detection + risk aggregation


def test_multiple_tags_aggregate_to_high():
    note = (
        "本課程限本系，且不開放網路選課；採人工加選，"
        "全英文授課，使用 Microsoft Teams 進行同步遠距"
    )
    r = parse_note(note)
    assert "online_selection_unavailable" in keys(r)
    assert "manual_selection_required" in keys(r)
    assert "restricted" in keys(r)
    assert "english_taught" in keys(r)
    assert "remote" in keys(r)
    assert r["risk_level"] == "high"


def test_only_low_warnings_means_low_risk():
    r = parse_note("全英文授課，遠距教學")
    assert r["risk_level"] == "low"


def test_medium_only_promotes_to_medium():
    r = parse_note("採人工加選，密集授課")
    assert r["risk_level"] == "medium"


# ---------------------------------------------------------------------------
# 4. rule extraction for restrictions


def test_restriction_rules_capture_each_phrase():
    r = parse_note("限本系、限大三、限大四，非本系不得修習")
    values = sorted(rule["value"] for rule in r["rules"])
    assert "限本系" in values
    assert "限大三" in values
    assert "限大四" in values
    assert "非本系不得修習" in values


def test_restriction_rules_dedupe():
    r = parse_note("限本系，限本系（重申）")
    matches = [rule for rule in r["rules"] if rule["value"] == "限本系"]
    assert len(matches) == 1


# ---------------------------------------------------------------------------
# 5. tolerant-to-noise / hygiene


def test_leading_trailing_whitespace_does_not_block():
    r = parse_note("\n\t  全英文授課  \n")
    assert "english_taught" in keys(r)


def test_punctuation_separated_keywords():
    r = parse_note("人工加選；限本系；遠距教學")
    assert {"manual_selection_required", "restricted", "remote"}.issubset(set(keys(r)))


# ---------------------------------------------------------------------------
# 6. negative cases (must NOT match)


@pytest.mark.parametrize(
    "note",
    [
        # Contains 限 but not a restriction phrase
        "本班限選2學分，請依需求調整",
        # 平均 used in unrelated context
        "本課程要求學生課堂平均出席8次以上",
        # 本系 without 限 prefix
        "請依本系規定選修",
        # 普通課程描述
        "課程內容包含三大主題,評分以期中考、期末考、報告為主。",
        # Course code alone
        "請參考授課大綱",
    ],
)
def test_benign_notes_have_no_tags(note):
    r = parse_note(note)
    assert keys(r) == [], f"unexpected tags for: {note!r} -> {r}"
    assert r["rules"] == []
    assert r["risk_level"] == "low"


# ---------------------------------------------------------------------------
# 7. real samples from the 114-1 scrape


def test_real_sample_workshop():
    note = (
        "共選修1-4(文學院開)\n"
        "密集授課，採人工加選。上課時間為114年7月5、6、16、17、18、19日"
        "至日本移地教學，需確認六天課程皆能參與。"
    )
    r = parse_note(note)
    assert "irregular_schedule" in keys(r)
    assert "manual_selection_required" in keys(r)


def test_real_sample_drama_no_manual_is_not_misclassified():
    """`不開放人工加選` reverses the meaning — we must not flag it as
    `manual_selection_required`. Negative-lookbehind in the keyword list
    guards against this."""
    note = "共選修1-4(文學院開)\n文創學程選修，上限30人，不開放人工加選"
    r = parse_note(note)
    assert "manual_selection_required" not in keys(r)


def test_negation_prefixes_block_manual_selection():
    for prefix in ["不開放", "不得", "禁止"]:
        r = parse_note(f"本課程{prefix}人工加選")
        assert "manual_selection_required" not in keys(r), prefix


def test_positive_form_still_detected():
    r = parse_note("本課程採人工加選")
    assert "manual_selection_required" in keys(r)
