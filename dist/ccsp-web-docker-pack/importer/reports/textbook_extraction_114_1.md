# Textbook Extraction Report — 114-1

> Generated automatically by `python -m ccsp_importer.cli extract-textbooks --year 114 --semester 1`

---

## 1. Summary

| Metric | Value |
| --- | ---: |
| total_details | 2893 |
| attempted | 2893 |
| extracted_count | 115 |
| unchanged_count | 0 |
| no_textbook_count | 7 |
| suspicious_long_count | 0 |
| extraction_rate | 4.0% |

## 2. Keyword Distribution

| Keyword / Marker | Courses |
| --- | ---: |
| 自編講義 | 44 |
| Textbook | 18 |
| 教師自編講義 | 15 |
| 教材 | 9 |
| 無指定教材 | 7 |
| 參考教材 | 7 |
| 主要教材 | 6 |
| 講義 | 4 |
| Required text | 1 |
| 課堂講義 | 1 |
| 指定教材 | 1 |
| handouts | 1 |
| textbook | 1 |

## 3. Sample Extractions

| course_code | course_name | keyword | textbook_preview |
| --- | --- | --- | --- |
| 0004 | 台日交流與文化轉譯 | 教師自編講義 | 教師自編講義 |
| 0005 | 口語表達與教學實踐 | 自編講義 | 自編講義 |
| 0022 | 文學概論 | 教師自編講義 | 教師自編講義 |
| 0023 | 中文：文學思辨與敘事素養 | 自編講義 | 自編講義 |
| 0031 | 歷代文選及習作 | 主要教材 | 自編講義 |
| 0032 | 中國思想史 | 自編講義 | 自編講義 |
| 0042 | 思辨性閱讀與報告寫作 | 教師自編講義 | 教師自編講義 |
| 0053 | 莊子 | 教材 | 黃錦鈜：《新譯莊子讀本》，台北：三民書局。 |
| 0060 | 聲音與口語表達教學 | 自編講義 | 自編講義 |
| 0097 | 西洋文學作品導讀（一） | Textbook | Kelly J. Mays, The Norton Introduction to Literature (Shorter 14th edition). 

H |

## 4. Suspicious Samples

_None._

## 5. No Textbook Samples

| course_code | course_name | reference_books_preview |
| --- | --- | --- |
| 0001 | 口述歷史製作 | 李向平、魏揚波著，《口述史研究方法》，上海：上海人民出版社，2010年4月。

楊祥銀，《與歷史對話：口述史學的理論與實踐》，北京：中國社會科學出版社，2004。

Howarth, Ken，陳瑛 |
| 0002 | 文創實習 | 依照不同實習單位提供參考書目。 |
| 0003 | 戲劇展演 | 平田織佐(平田オリザ):《演劇入門》,戴開成譯,台北:書林出版有限公司,2015年。

"彼得・布魯克(Peter Brook):《開放的門:對於表演與劇場的思考》,陳敬旻譯,台北:書林出版有限公
 |
| 0006 | 聲入其境：配音、角色分析、表達 | 特にありません。 |
| 2961 | 幸福學與生命設計（一） | 教師自編教材 |
| 2962 | 幸福學與生活美學（一） | 哈佛大學幸福15堂課 |
| 2963 | 世界公民議題討論課（一） | 由授課老師安排選讀 |
| 2964 | 自然科學討論課 | 物理奇遇記：湯普金斯先生的相對論及量子力學之旅

The New World of Mr. Tompkins

原文作者： George Gamow, Russell Stannard

譯者： |
| 2965 | 社會科學討論課 | 季辛格，世界秩序。

賽門西奈克，無限賽局。

李偉文，看見荒野。 |
| 2966 | 探究與實作（一） | 授課教師自行安排並提供文字資料、影音資料等。 |

## 6. Recommendations

- Extracted textbook for **115** courses (4.0% of attempted).
- `reference_books` 原文未被修改，textbook 欄位為獨立抽取結果。
- 若 `suspicious_long_count > 0`，請人工確認相關課程的抽取結果是否正確。
- 重複執行安全：已有 textbook 的課程若再次抽取到相同值，計為 `unchanged_count`。
- 若需調整規則，修改 `textbook_extractor.py` 後重跑即可（冪等）。

---
_Report for 114-1. Extracted: 115/2893, Rate: 4.0%._