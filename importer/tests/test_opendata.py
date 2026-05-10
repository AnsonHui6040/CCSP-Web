from ccsp_importer.opendata import DeptIndexEntry, _parse_dept_index


def test_parse_dept_index_recovers_unquoted_commas_in_course_name():
    csv_text = "\n".join(
        [
            "學年,學期,選課代碼,課程名稱,開課系所代碼,開課系所名稱,必選修,學分1,學分2",
            "114,2,2871,Esports, Speedrunning, and Video Games,930,國際學院不分系英語學士班,3,0,3",
            "114,2,3386,Honors: Same Right, Different Rules? - understanding modern civil rights,S04,多元學習課程(共同選修),3,0,2",
        ]
    )

    entries = _parse_dept_index(csv_text)

    assert entries == [
        DeptIndexEntry("930", "國際學院不分系英語學士班"),
        DeptIndexEntry("S04", "多元學習課程(共同選修)"),
    ]
