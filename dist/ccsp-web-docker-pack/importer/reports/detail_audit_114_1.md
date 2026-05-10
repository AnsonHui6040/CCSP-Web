# Detail Scrape Audit — 114-1

> Generated automatically by `python -m ccsp_importer.cli audit-details --year 114 --semester 1`

---

## 1. Summary

| Metric | Value |
| --- | ---: |
| total_courses | 2893 |
| total_in_course_details | 2893 |
| not_attempted | 0 |
| success_count | 2893 |
| skipped_count | 0 |
| parse_error_count | 0 |
| http_error_count | 0 |
| not_found_count | 0 |

## 2. Fetch Status Distribution

| fetch_status | count |
| --- | ---: |
| success | 2893 |

## 3. Field Coverage

Coverage % is relative to `success_count = 2893`.

| Field | Count | Coverage |
| --- | ---: | ---: |
| course_description | 2877 | 99.4% |
| teaching_goal | 2877 | 99.4% |
| grading_policy | 2817 | 97.4% |
| textbook | 115 | 4.0% |
| reference_books | 2877 | 99.4% |
| office_hour | 2877 | 99.4% |
| syllabus_url | 2877 | 99.4% |
| detailed_note | 2877 | 99.4% |

## 4. Section Frequency

Most common section keys in `raw_sections_json` (across all successful courses):

| Section Key | Appears In |
| --- | ---: |
| 評分方式 | 2877 |
| 選課分析 | 2877 |
| 授課教師 | 2877 |
| 教育目標 | 2877 |
| 課程資訊 | 2877 |
| 參考書目 | 2877 |
| 開課紀錄 | 2877 |
| 課程概述 | 1311 |

## 5. Missing Sections

Sections that appear in ≥50% of courses but are absent in some:

| Section Key | Missing In |
| --- | ---: |
| 評分方式 | 16 |
| 課程資訊 | 16 |
| 參考書目 | 16 |
| 開課紀錄 | 16 |
| 教育目標 | 16 |
| 選課分析 | 16 |
| 授課教師 | 16 |

## 6. Error Samples

### parse_error

_None._

### http_error

_None._

### not_found

_None._

## 7. Raw Sections Samples

- **1752**: `評分方式`, `選課分析`, `授課教師`, `教育目標`, `課程資訊`, `參考書目`, `開課紀錄`
- **0001**: `評分方式`, `選課分析`, `授課教師`, `教育目標`, `課程概述`, `課程資訊`, `參考書目`, `開課紀錄`
- **0002**: `評分方式`, `選課分析`, `授課教師`, `教育目標`, `課程資訊`, `參考書目`, `開課紀錄`

## 8. HTML Variants

目前未發現明顯 HTML page variant（所有課程使用相同的 `/view/{y}/{s}/{code}` 結構）。
若 parse_error_count > 0，請查看 §6 的錯誤樣本並人工確認對應的 `.html` 快取檔。

## 9. Recommendations

- **textbook 覆蓋率低（4.0%）**：建議做 P7 textbook extractor 強化。

---
_Audit generated for 114-1. Total courses: 2893, Success: 2893, Coverage: 100.0% of all courses._