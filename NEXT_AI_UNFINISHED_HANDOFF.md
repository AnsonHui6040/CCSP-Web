# CCSP Web 未完成項目交接文件

> 給下一個接手的 AI 或開發代理。
> 讀完這份文件，你應該能在不重讀整段對話的情況下接續開發。
> **重要**：請不要重做已完成的 P1–P5B（成本浪費），也不要把開發方向帶偏到「自動搶課 / 登入校務系統」這類明確被排除的功能。

最後更新：2026-05-09（P5B 完成後）

---

## 目錄

1. [專案目前狀態摘要](#1-專案目前狀態摘要)
2. [已完成階段表](#2-已完成階段表)
3. [目前最重要的未完成項目](#3-目前最重要的未完成項目)
4. [絕對不要做的事](#4-絕對不要做的事)
5. [Repo Layout 與技術棧](#5-repo-layout-與技術棧)
6. [資料流總覽](#6-資料流總覽)
7. [SQLite Schema 速查](#7-sqlite-schema-速查)
8. [常用指令](#8-常用指令)
9. [模組責任分配](#9-模組責任分配)
10. [已知限制](#10-已知限制)
11. [作者的工作模式偏好](#11-作者的工作模式偏好)
12. [曾經踩過的雷](#12-曾經踩過的雷)

---

## 1. 專案目前狀態摘要

| 欄位 | 內容 |
|---|---|
| 專案名稱 | CCSP Web |
| 全名 | Course Choice & Schedule Planner Web |
| 中文定位 | 大學課程選擇建議及課表編排網頁（**不是課程查詢器**） |
| 目標學校 | 東海大學（Tunghai University） |
| 資料來源 | https://course.thu.edu.tw/ |
| Repo 路徑 | `C:\Users\anson\Documents\GitHub\CCSP-Web` |
| 作者語言 | 繁體中文（回覆務必使用） |

**核心定位**：這個系統不是查詢工具，是**選課決策平台**。所有功能取捨都應傾向「降低選錯課的風險」（候選池、衝堂、風險 tag）而非「讓資料看起來漂亮」。

### 目前已完成的核心能力

- ✅ 課程資料 scrape / import（86 系所 / 2893 門課，114-1 學期完整）
- ✅ 課程搜尋頁（`/courses`），含 dept / weekday / required / open / tag 風險篩選 + 分頁
- ✅ 候選課程池（localStorage `ccsp.candidates.v2`，跨 tab 同步）
- ✅ 備註 tags / warnings / rules / risk_level 解析（10 類 tag）
- ✅ 預排課表（`/schedule`），含 candidate→schedule 整合
- ✅ 衝堂分析（純函數 `findAllConflicts` + grid cell 高亮）
- ✅ 預排模式 / 正式模式（official 模式禁止確認衝堂課）
- ✅ 課程詳細頁（`/courses/[year]/[semester]/[courseCode]`）
- ✅ Row-span merged calendar block（同日連續節次合併為單一 block）
- ✅ 衝堂 block 並排顯示（同一節重疊的多門課自動切欄）

### 目前測試狀態

| 指令 | 結果 |
|---|---|
| `cd web && npm test` | **105/105 pass**（5 個檔，~700 ms） |
| `cd web && npm run typecheck` | clean |
| `cd importer && python -m pytest tests -q` | **48/48 pass**（note_parser 32 + parse_detail 16） |
| `/courses` SSR | HTTP 200 |
| `/schedule` SSR | HTTP 200（client-side hydration 後渲染 grid） |
| `/courses/114/1/1752` SSR | HTTP 200，detail 完整 |
| `/courses/114/1/0091` SSR（無 detail） | HTTP 200，placeholder 顯示 |

### 目前資料庫狀態（`data/ccsp.sqlite`）

- `courses`：2893 列（114-1）
- `course_details`：57 列已成功抓取（`fetch_status='success'`，dept 100 + 1752 + limit 50 樣本）
- `scrape_runs` / `detail_scrape_runs`：審計資料完整

---

## 2. 已完成階段表

| 階段 | 狀態 | 說明 |
|---|---|---|
| Priority 1 | ✅ 已完成 | 課程資料匯入、SQLite schema、搜尋頁、候選池、CourseCard 顯示 |
| Priority 2 | ✅ 已完成 | 備註解析（10 類 tags）、warnings、rules、risk_level、tag 篩選 UI |
| Priority 3 | ✅ 已完成 | conflict.ts、scheduleStats.ts、scheduleStore（mode-aware confirm）、`/schedule` 頁、Sidebar |
| Priority 3.5 | ✅ 已完成 | 驗收修補、localStorage 損壞防護、跨學期 identity bug 修正、refactor 候選池暴露 imperative API |
| Priority 4 | ✅ 已完成 | course.thu.edu.tw/view/ 詳細資料補爬、course_details 表、parse_detail.py、`scrape-details` CLI、課程詳細頁 |
| P5A | ✅ 已完成 | scheduleLayout.ts、CSS Grid + row-span merged calendar block |
| P5B | ✅ 已完成 | overlap connected-components + interval coloring，衝堂 block 並排顯示（absolute inset 切欄） |
| **P5B-人工驗收** | ⚠️ 未完成 | 演算法 + SSR 已驗，但人眼看瀏覽器互動仍未確認 |
| **P6** | ⚠️ 未完成 | 完整 114-1 detail scrape（2893 門 ≈ 72 分鐘）+ 全資料 audit + HTML 變體調查 |
| **P7** | ⚠️ 未完成 | 教材欄位強化（從教育目標 / 課程概述抽 `教材：` / `Textbook:` 字樣）|
| **P8** | ⚠️ 未開始 | PDF / PNG / 行事曆 / 分享連結 export（作者已說此階段暫緩） |
| **P9+** | ⚠️ 待規劃 | drag-and-drop / AI 推薦 / 帳號系統 / 雲端同步（多數在「不要做」名單上） |

---

## 3. 目前最重要的未完成項目

### Priority A — P5B 瀏覽器人工驗收（最高優先）

**狀態**：演算法 + SSR HTTP 200 已驗證；瀏覽器內視覺互動尚未由人確認。

**為什麼優先**：P5B 的 absolute inset 切欄是 CSS 級的視覺布局，純算法測試（`npm test`）保證 `overlapIndex` / `overlapCount` 正確，但「最終呈現是否真的不互相蓋住」唯有開瀏覽器才能驗。

**執行方式**：

```bash
cd web
npm run dev
# 開瀏覽器到 http://localhost:3000
```

依序執行下列場景，每個場景**截圖記錄**並回報：

1. **基準測試**（spec §10 場景 1）
   - `/courses` 搜尋「口述歷史製作」（114-1 文學院 0001），加入候選
   - `/courses` 搜尋「聲入其境」（114-1 文學院 0006），加入候選
   - `/schedule` → 候選 tab → 兩門「加入課表」
   - **預期**：星期四第 7 節只有 0001 全寬；第 8、9 節**兩 block 並排**（0001 在左半，0006 在右半），都帶橘色邊框
   - **驗收標準**：兩門課的課名都看得到，沒有任何一門被完全蓋住
2. **完全同節重疊**（spec §10 場景 2）
   - 找兩門星期、節次完全相同的課（可用 `python -m importer.ccsp_importer.cli ...` 查 DB 找樣本）
   - 加入課表 → **預期**：左右各佔 50%
3. **模式切換**（spec §10 場景 3、4）
   - 切「預排模式」→ 衝堂 block 為**橘色**
   - 切「正式模式」→ 衝堂 block 為**紅色**
   - 切回「預排模式」→ 顏色回到橘色，課程不消失
4. **移除回復**（spec §10 場景 5）
   - 移除其中一門 → 剩下的 block **自動恢復全寬（overlapCount=1）**
5. **窄螢幕**（spec §10 場景 6）
   - DevTools 模擬手機寬度 → grid 應**橫向捲動**，不擠壓
6. **多重衝堂**（壓力測試）
   - 嘗試加 3 門都在同一節的課 → 預期切成 3 欄

**回報格式**：每場景一句「✓ 通過 / ✗ 失敗（理由）」+ 截圖。失敗時把 console error / 樣式 inspector 截圖也帶上。

**如果有 bug**：先別自己改 P5B 演算法（已大量測過），優先檢查：
1. CSS 的 `position: absolute` + 父層 `position: relative` 是否被某個外層 reset
2. `box-sizing` 是否被某個 utility 蓋掉
3. `inset` 計算是否正確

相關檔案：
- `web/components/schedule/WeeklyGrid.tsx`（grid-cell wrapper）
- `web/components/schedule/ScheduleCourseBlock.tsx`（absolute inset 計算）
- `web/lib/scheduleLayout.ts`（演算法）

---

### Priority B — P6 完整 detail scrape + 全資料 audit

**狀態**：目前 `course_details` 只有 57 列。完整 114-1 有 2893 門課。

**目標**：跑完整一學期的 `/view/{y}/{s}/{code}` 抓取，跑完後產出 audit report，找出：
- HTML 結構變體（目前只見過 dept 100 + limit 50 共 57 門的樣本）
- 解析失敗的 sample raw_sections（檢查是否需要 parser fix）
- 缺資料的 long-tail（特殊系所 / 體育 / 通識變體）

**執行方式**：

1. **背景跑完整 scrape**（約 72 分鐘，可中斷可恢復）

   ```bash
   cd importer
   # 推薦在背景跑 + 加 --only-missing（已抓的不重抓）
   python -m ccsp_importer.cli scrape-details \
     --year 114 --semester 1 \
     --only-missing --sleep 1.5
   ```

   - 每個 request 1.5 s，固定 User-Agent，已加 polite session
   - HTML cache 落在 `data/raw/114-1/details/{code}.html`，重跑會跳過已成功的
   - 中斷後重跑：同樣命令即可
   - 預期 72 分鐘左右；可用 `tail -f` 監看 log

2. **跑完後驗 audit**

   ```bash
   # 重跑 scrape-details（會 0 queued + 直接輸出 report）
   python -m ccsp_importer.cli scrape-details --year 114 --semester 1
   ```

   stats JSON 包含 attempted / success / parse_error / http_error / not_found、每欄位覆蓋率、section_frequency、sample_parse_errors、sample_raw_sections。

3. **如果發現 parse_error > 0**

   - 看 `sample_parse_errors` 找對應 course_code
   - 把該課 HTML 從 `data/raw/114-1/details/{code}.html` 開出來看
   - 修 `importer/ccsp_importer/parse_detail.py`
   - bump `DETAIL_PARSER_VERSION` 字串（在 `config.py`）→ 下次跑會 re-parse from cache（無需重新抓網路）
   - 加對應 unit test 進 `importer/tests/test_parse_detail.py`

4. **如果發現 http_error / not_found > 0**

   - 通常是該 courseCode 在 /view-dept 抓到但 /view/{code} 回 404（資料不一致）
   - 接受，不要重試。在 audit report 中列出即可。

**驗收標準**：

- success_count ≥ 2890（即 < 5 門失敗，可接受）
- parse_error_count = 0
- 每個結構化欄位（description / teaching_goal / grading_policy / reference_books / office_hour / syllabus_url / detailed_note）覆蓋率 ≥ 95%
- 沒有發現新的 HTML 變體導致 0001/1752 的 fixture 測試失敗

**輸出**：把 audit JSON 整理成 markdown report，列出：
- 統計數字
- 出現新 HTML 變體的 sample course_codes
- 修了哪些 parser bug
- 哪些欄位覆蓋率低、原因（例：`textbook` 0%——是因為 THU 頁面只有「參考書目」section，沒有獨立「教材」）

**不要做**：
- ❌ 把 sleep 時間調短（會被視為高頻抓取，違反第 4 節的禁忌）
- ❌ 平行多執行緒抓（同上）
- ❌ 在這階段順便重跑整個 dept-list scrape

相關檔案：
- `importer/ccsp_importer/detail_scraper.py`（orchestration）
- `importer/ccsp_importer/parse_detail.py`（parser）
- `importer/ccsp_importer/config.py`（`DETAIL_PARSER_VERSION` 在此）
- `importer/schema.sql`（course_details 表）

---

### Priority C — P7 教材欄位強化

**狀態**：目前 `course_details.textbook` 在 57 門樣本中 **覆蓋率 0%**。THU 頁面有「參考書目」section（已存到 `reference_books`），但沒有獨立「教材」section。教材資訊可能藏在「教育目標」或「課程概述」內文中。

**目標**：從 `teaching_goal` / `course_description` 純文字抽出教材關鍵字附近的句子，補 `textbook` 欄位。

**執行步驟**：

1. **先樣本分析**（1 小時內）

   ```bash
   cd /c/Users/anson/Documents/GitHub/CCSP-Web
   PYTHONIOENCODING=utf-8 python -X utf8 -c "
   import sqlite3, re
   conn = sqlite3.connect('data/ccsp.sqlite')
   for r in conn.execute(\"SELECT course_code, teaching_goal FROM course_details WHERE fetch_status='success' AND teaching_goal IS NOT NULL\"):
       text = r[1]
       for kw in ['教材', '課本', 'Textbook', 'textbook']:
           if kw in text:
               # 印出含關鍵字的 ±100 字 context
               idx = text.find(kw)
               print(f'{r[0]} [{kw}]: {text[max(0,idx-100):idx+200]}')
               print('---')
   "
   ```

   觀察：
   - 「教材」在文中通常後面跟什麼字（`：`、`如`、`包含`、空行…）
   - 是不是常與「參考」、「書目」混用
   - 是否大多隱含在「使用 X 教材」這類句型

2. **設計抽取規則**

   建議起點：
   ```python
   # importer/ccsp_importer/extract_textbook.py
   _TEXTBOOK_RE = re.compile(
       r"(?:教材|課本|Textbook[s]?|參考用書)\s*[:：]?\s*(.+?)(?=\n\s*(?:教育目標|課程概述|參考書目|評分|\Z))",
       re.IGNORECASE | re.DOTALL,
   )
   ```

   先用 50-100 個樣本測，逐步調整。**不要過度泛化**——寧可漏，不要錯抽課程內文當作教材。

3. **加 unit test**

   `importer/tests/test_extract_textbook.py` 至少 10 case：
   - 顯式「教材：XXX」格式
   - 「Textbook: XXX」格式
   - 沒有教材關鍵字的課（應回 null，不亂猜）
   - 教材在「教育目標」尾段
   - 多種教材列表（用 `\n` 或頓號分隔）
   - 已有 `reference_books` 的課，textbook 應與其不同（不要重複）

4. **回填**

   不需要重新跑 scrape——`course_details.raw_sections_json` 已保留原文。寫一個 `parse-textbook` CLI（類似 `parse-notes`）：

   ```bash
   python -m ccsp_importer.cli parse-textbook --year 114 --semester 1
   ```

   做的事：
   - 讀 `course_details.teaching_goal` + `course_description`
   - 跑 `extract_textbook(text)` → string | None
   - UPDATE `course_details.textbook`
   - 輸出統計：覆蓋率變化、抽出 sample

5. **同步 web 端**

   - `web/lib/queries.ts` 的 `rowToDetail` 已有 `textbook` 欄位，無需改
   - `web/app/courses/[year]/[semester]/[courseCode]/page.tsx` 的「教材 / 參考書目」card 會自動顯示新值

**驗收標準**：
- 抽出來的 textbook 抽樣人工檢查 30 筆，**正確率 ≥ 80%**（這是 best-effort heuristic，不要追求 100%）
- 沒有把參考書目當作教材（避免重複資訊）
- 沒抽到的課 textbook 為 null（不要塞垃圾）
- npm test / pytest 全綠

**不要做**：
- ❌ 用 LLM 抽教材（spec 明示不做 AI 推薦 / 解析）
- ❌ 從外部網站（書局、亞馬遜）找書名

---

### Priority D — P8 export / sharing（作者已說暫緩，但仍在 backlog）

**狀態**：未開始。作者在 P5A 結束前的 turn 明確表示「先不要做 PDF / PNG / 分享連結」。**除非作者明說啟動，不要在這階段動手。**

如果未來作者要求做，這裡是預先記錄的方向：

- **PNG / PDF 課表 export**：用 `html-to-image` 或 `puppeteer` 把 `/schedule` 的 grid 區塊截圖。注意 server-side rendering 需要 hydration 後的 DOM，可能需要 client-side `html2canvas`。
- **行事曆 (.ics) export**：依 `timeSlots` 推第一週上課日期，產出 RRULE 重複事件。THU 行事曆需要查當學期實際開學日。
- **分享連結**：兩種選擇——
  - URL 編碼整個 schedule state（base64 + LZ-string 壓縮）→ 無 server，但 URL 可能很長
  - 後端存 short-id → 需要 server 與儲存層，違反目前「localStorage-only」架構，不建議
- **不要**做帳號系統 / 雲端同步（明確 out-of-scope）

---

### Priority E — 雜項小改善（任何時候可做）

非阻塞性、可隨時撿起來的小事：

- **完整 audit re-run**：跑 `python -m ccsp_importer.ccsp_importer.audit --year 114 --semester 1`（檔案 `importer/ccsp_importer/audit.py`，非 CLI 入口，需用 `python -m` 完整路徑）。
- **新增學期**：當 THU 釋出 114-2 的 opendata，跑 `python -m ccsp_importer.cli scrape --year 114 --semester 2` 即可。Web 的 `TermSwitcher` 會自動列出。
- **CourseCard accessibility**：目前 `<article>` + `<dl>` 結構合理，但 tag badge 缺 `aria-label`，可補。
- **Dark mode 切換**：目前 hard-coded `dark` class 在 `<html>` 上，沒切換 UI。可加但不必。

---

## 4. 絕對不要做的事

這些是作者明確列出的禁忌（出現在 spec 與多輪對話中）。**不要因為「順便做一下」而碰觸**：

| 禁忌項目 | 為什麼 |
|---|---|
| 自動登入學校 OAuth / 校務系統 | 違反 THU 條款；作者明確排除 |
| 自動搶課 / 自動加選 | 同上 |
| 高頻名額即時監控（< 1 分鐘輪詢） | 對 THU 服務造成負擔 |
| AI 推薦 / 自動排課 | 作者明示不做；這個專案是「給人用的決策工具」，不是「替人決策的工具」 |
| 雲端同步 / 多裝置同步 | localStorage-only 是有意選擇 |
| 完整伺服器端帳號系統 | 同上 |
| 把 scrape `--sleep` 調到 < 1.5 s | 違反 polite session 約定 |
| 把 better-sqlite3 換回來 | Node 24 + Windows 沒 prebuilt binary，會掉到 VS Build Tools；目前用 `node:sqlite` 故意避開 |
| Drag-and-drop schedule | 作者數次明示「不需要拖曳」（spec §5）。課程時間是固定的，點擊即可 |
| Row-span 跨多週的 calendar block | P5A/B 已決定每週獨立渲染 |

如果作者主動要求做上面的事，**先確認一次**：「這項目原先在 not-do 清單，你確定要做嗎？」再執行。

---

## 5. Repo Layout 與技術棧

```
CCSP-Web/
├── README.md
├── NEXT_AI_UNFINISHED_HANDOFF.md  ← 你正在看的這份
├── .gitignore
│
├── web/                            Next.js 15 App Router 前端
│   ├── package.json                deps: next/react/react-dom/tailwindcss(v4)
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   ├── vitest.config.ts            test runner config
│   ├── app/
│   │   ├── layout.tsx              root layout, dark mode, Tailwind v4 @theme
│   │   ├── globals.css             single CSS file (Tailwind v4 CSS-first)
│   │   ├── page.tsx                home (links to /courses, /schedule)
│   │   ├── courses/
│   │   │   ├── page.tsx            search + filters + candidate panel
│   │   │   └── [year]/[semester]/[courseCode]/page.tsx  detail page
│   │   └── schedule/
│   │       ├── page.tsx            server entry (renders Navbar + ScheduleClient)
│   │       └── ScheduleClient.tsx  client; uses scheduleStore + scheduleLayout
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── CandidateButton.tsx
│   │   ├── CandidatePoolPanel.tsx  /courses 浮動候選池
│   │   ├── candidatePoolStore.ts   localStorage store (v2 with snapshot)
│   │   ├── CourseCard.tsx
│   │   ├── CourseDetailActions.tsx
│   │   ├── FilterSidebar.tsx
│   │   ├── SearchForm.tsx
│   │   ├── TermSwitcher.tsx
│   │   └── schedule/
│   │       ├── WeeklyGrid.tsx              CSS Grid + grid-cell wrappers
│   │       ├── ScheduleCourseBlock.tsx     absolute-inset block; supports overlap切欄
│   │       ├── ScheduleSidebar.tsx         5-tab sidebar
│   │       ├── ScheduleToolbar.tsx
│   │       ├── ScheduleStatsPanel.tsx
│   │       ├── ConflictList.tsx
│   │       └── NoTimeCourseList.tsx
│   ├── lib/
│   │   ├── db.ts                   getDb() — singleton node:sqlite handle (read-only)
│   │   ├── queries.ts              SSR data layer (search/list/detail)
│   │   ├── types.ts                Course / TimeSlot / Teacher / Tag / etc.
│   │   ├── tags.ts                 TAG_DEFS — mirror of Python TAG_DEFS
│   │   ├── format.ts               UI formatter (no DB)
│   │   ├── courseSnapshot.ts       Course → StoredCourseSnapshot
│   │   ├── conflict.ts             coursesConflict / findCourseConflicts / findAllConflicts / getOccupiedSlots
│   │   ├── conflict.test.ts        26 cases
│   │   ├── scheduleStats.ts        computeStats / computeFreePeriods / PERIOD_ORDER
│   │   ├── scheduleStats.test.ts   16 cases
│   │   ├── scheduleStore.ts        useSchedule() + imperative API (add/confirm/remove/...)
│   │   ├── scheduleStore.test.ts   19 cases (with fakeWindow polyfill)
│   │   ├── scheduleLayout.ts       buildScheduleLayoutBlocks / assignOverlapColumns / blocksOverlap
│   │   ├── scheduleLayout.test.ts  34 cases
│   │   ├── scheduleLayout.realdata.test.ts  2 cases (dept 100 真實資料)
│   │   └── testSetup/fakeWindow.ts localStorage polyfill for unit tests
│
├── importer/                       Python 3 importer
│   ├── README.md
│   ├── requirements.txt            requests / beautifulsoup4 / lxml / pytest
│   ├── schema.sql                  applied idempotently by db.init_db()
│   ├── ccsp_importer/
│   │   ├── __init__.py
│   │   ├── config.py               URLs, paths, USER_AGENT, REQUEST_DELAY_SEC, DETAIL_PARSER_VERSION
│   │   ├── http_client.py          PoliteSession (single host, 1.5 s delay)
│   │   ├── models.py               Course / Teacher / TimeSlot dataclasses
│   │   ├── db.py                   init_db() + connect() + upsert_courses() + migrations
│   │   ├── opendata.py             read Big5 CSV → dept index
│   │   ├── parse_dept.py           BS4 parser for /view-dept/ HTML
│   │   ├── scraper.py              orchestration for /view-dept/ scrape
│   │   ├── note_parser.py          備註 → tags/warnings/rules/risk_level
│   │   ├── note_runner.py          parse-notes CLI runner
│   │   ├── parse_detail.py         /view/{y}/{s}/{code} HTML parser
│   │   ├── detail_scraper.py       per-course detail scrape orchestration
│   │   ├── audit.py                data-quality audit script
│   │   └── cli.py                  argparse entry: init-db / scrape / parse-notes / scrape-details
│   └── tests/
│       ├── __init__.py
│       ├── test_note_parser.py     32 cases
│       ├── test_parse_detail.py    16 cases
│       └── fixtures/
│           ├── detail_0001.html    real-page fixture
│           └── detail_1752.html    real-page fixture
│
├── data/                           git-ignored
│   ├── ccsp.sqlite                 shared DB
│   └── raw/{year}-{sem}/           HTML cache
│       ├── opendata.csv            UTF-8 decoded from Big5
│       ├── dept-{code}.html        /view-dept/ pages
│       └── details/{code}.html     /view/ pages
│
└── tmp_inspect/                    ad-hoc research; git-ignored
```

### 技術棧

| 層 | 選擇 | 理由 |
|---|---|---|
| 前端 framework | Next.js 15 App Router + React 19 | App Router 的 server/client component 模型乾淨 |
| TypeScript | 5.7 strict | typecheck 是 hard gate |
| CSS | Tailwind CSS **v4**（CSS-first via `@theme`） | 簡單、無 config 檔污染 |
| 前端 DB 存取 | Node 24 內建 `node:sqlite` | **不要**換成 better-sqlite3（Node 24 + Windows 沒 prebuilt） |
| 前端測試 | Vitest 3 | 原生 TS 支援 |
| 後端 scraper | Python 3.9 + requests + bs4 + lxml | 標準組合 |
| 後端測試 | pytest | 標準 |
| 資料庫 | SQLite（單檔，無 server） | 個人工具，無需 PostgreSQL |
| 候選池 / 課表狀態 | localStorage（`useSyncExternalStore`） | 故意不上 server |

---

## 6. 資料流總覽

### Scrape pipeline

```
opendata CSV (Big5)               <-- /opendatadownload/list/{y}/{s}/
   │
   │ opendata.fetch_dept_index    -- 86 unique dept_codes
   ▼
/view-dept/{y}/{s}/{dept}/ HTML   <-- 86 個 dept 列表頁，1.5s/req
   │
   │ parse_dept.parse_dept_page   -- 解析每筆課程
   ▼
courses 表（2893 列）
   │
   │ note_runner.parse_notes_for_term
   ▼
courses.tags_json/warnings_json/rules_json/risk_level
   │
   │ detail_scraper.scrape_details  <-- /view/{y}/{s}/{code} HTML, 1.5s/req
   ▼
course_details 表（目前 57 列；P6 完成後應達 ~2890）
```

### Web 渲染

```
SSR pages (server components)
   │
   │ getDb() → node:sqlite read-only
   │ queries.ts: searchCourses / listTerms / listDepartments / getCourseByCode / getCourseWithDetails
   ▼
Course / CourseWithDetails plain objects
   │
   │ pass to client components (must be plain objects — node:sqlite rows
   │ have non-plain prototype, queries.ts converts via rowToCourse/rowToDetail)
   ▼
Client components (CandidateButton / CourseDetailActions / ScheduleClient)
   │
   │ useSchedule() / useCandidatePool() — useSyncExternalStore + localStorage
   ▼
findAllConflicts / buildScheduleLayoutBlocks / computeStats
   │
   ▼
WeeklyGrid CSS Grid + ScheduleCourseBlock absolute inset 切欄
```

---

## 7. SQLite Schema 速查

完整 schema 在 `importer/schema.sql`。重點欄位：

### `courses`
PK：implicit `id`；UNIQUE：`(year, semester, course_code)`

| 欄位 | 用途 |
|---|---|
| `course_code` | THU 內部 4-char code |
| `course_name` / `course_name_en` | 中英課名 |
| `required_or_elective` | 「選修」/「必修」/「通識」prefix |
| `credits_lecture` / `credits_lab` / `credits_total` | float |
| `dept_code` / `dept_name` | 開課單位 |
| `teachers_json` | `[{name, slug}, ...]` |
| `time_raw` / `time_slots_json` | 原時間字串 + `[{weekday, periods, classroom}, ...]` 結構化 |
| `capacity` / `enrolled` / `remaining` | 名額（remaining 為 NULL 代表 over-capacity） |
| `raw_note` | 原始備註文字 |
| `tags_json` / `warnings_json` / `rules_json` / `risk_level` | P2 解析結果 |
| `course_profile_id` | THU 歷史開課紀錄 ID |
| `scraped_at` | ISO8601 UTC |

### `course_details`
PK：`(year, semester, course_code)`

| 欄位 | 用途 |
|---|---|
| `detail_url` | 絕對 URL |
| `course_description` / `teaching_goal` | 課程概述 / 教育目標純文字 |
| `grading_policy_json` | `[{item, percent, note}, ...]` |
| `textbook` / `reference_books` | 教材（**0% 覆蓋，待 P7**）/ 參考書目 |
| `office_hour` / `syllabus_url` / `detailed_note` | |
| `teachers_json` / `teaching_assistants_json` | |
| `raw_sections_json` | `{section_name: text}` — 保留所有 section 原文，方便 parser 升級後 re-parse |
| `fetched_at` / `parser_version` / `fetch_status` / `error_message` | bookkeeping |

`fetch_status` ∈ `{success, skipped, parse_error, http_error, not_found}`

### `scrape_runs` / `detail_scrape_runs`
審計表，每次 scrape 寫一筆。用於追蹤失敗 / 統計。

### `meta`
key-value（目前未使用，預留）。

---

## 8. 常用指令

從 repo root（`C:\Users\anson\Documents\GitHub\CCSP-Web`）執行：

```bash
# === Importer ===

# 第一次設定
cd importer
pip install -r requirements.txt

# Schema 初始化（idempotent）
cd .. && python -m importer.ccsp_importer.cli init-db

# 抓一個系所（dept 100 文學院 6 門）
python -m importer.ccsp_importer.cli scrape --year 114 --semester 1 --dept 100

# 抓整學期 dept-list（86 系所，~2 分鐘）
python -m importer.ccsp_importer.cli scrape --year 114 --semester 1

# 解析備註
python -m importer.ccsp_importer.cli parse-notes --year 114 --semester 1

# 抓單一課程詳細頁
python -m importer.ccsp_importer.cli scrape-details \
  --year 114 --semester 1 --course 1752

# 抓某系所詳細頁
python -m importer.ccsp_importer.cli scrape-details \
  --year 114 --semester 1 --dept 100

# 抓 N 門詳細頁（smoke test）
python -m importer.ccsp_importer.cli scrape-details \
  --year 114 --semester 1 --limit 50

# 抓尚未抓的詳細頁（resumable，~72 分鐘 for 完整學期）
python -m importer.ccsp_importer.cli scrape-details \
  --year 114 --semester 1 --only-missing --sleep 1.5

# Audit 報告
python -m importer.ccsp_importer.audit --year 114 --semester 1

# Python 測試
cd importer && python -m pytest tests -v
# 或從 repo root:
python -m pytest importer/tests -v


# === Web ===

cd web

# 第一次設定
npm install   # 不會碰到 better-sqlite3 native build（用 node:sqlite）

# Dev server
npm run dev
# → http://localhost:3000

# 測試
npm test                # 一次跑完
npm run test:watch      # watch mode

# Type check
npm run typecheck

# Build
npm run build
```

### 環境注意

- **Windows console 編碼**：Big5 / cp950 預設不能輸出某些中文字元（如「冨」）。Python script 印中文時要加 `PYTHONIOENCODING=utf-8 python -X utf8 ...`。或寫到檔案再讀。**SQLite DB 內容是 UTF-8 不受影響**——只是 print 出來才會炸。
- **Bash cwd 持續性**：Bash tool 的 working directory 在指令間會延續。`cd importer && X` 之後下一個 bash 仍在 `importer/`。要回 repo root 用 `cd /c/Users/anson/Documents/GitHub/CCSP-Web` 或在 Python 用絕對路徑。
- **ts-node / tsx**：repo 沒裝 `tsx`，要寫一次性 TS 驗證 script，請用 Vitest 寫測試（範例：`web/lib/scheduleLayout.realdata.test.ts`）。

---

## 9. 模組責任分配

### Web side

| 模組 | 責任 | 不該負責 |
|---|---|---|
| `lib/db.ts` | 提供唯一 read-only handle | DB 寫入；那是 importer 的事 |
| `lib/queries.ts` | SQL → plain JS object | UI 渲染 |
| `lib/conflict.ts` | 衝堂判定的純算法 | 顯示 |
| `lib/scheduleStats.ts` | 學分 / 每日課量 / 空堂分析 | 衝堂（屬 conflict.ts） |
| `lib/scheduleStore.ts` | localStorage CRUD + mode-aware confirm | UI 互動 |
| `lib/scheduleLayout.ts` | 把 courses + conflicts → 顯示 block + 並排座標 | 衝堂判定（接收 conflicts，不重新算） |
| `components/schedule/*` | 渲染 | 業務邏輯（呼叫 store / lib） |
| `app/courses/page.tsx` | SSR 入口；URL → query params → SSR | 客戶端互動（交給 client component） |
| `app/schedule/ScheduleClient.tsx` | 編排 store → conflict → layout → render | 細節 UI（拆給 sub-components） |

### Importer side

| 模組 | 責任 |
|---|---|
| `config.py` | 全部魔術字串（URL、UA、delay、parser_version） |
| `http_client.py` | `PoliteSession`：保證 1.5s delay、固定 UA |
| `db.py` | schema 套用、connect、upsert、migration |
| `parse_dept.py` | /view-dept/ HTML → Course |
| `parse_detail.py` | /view/{code} HTML → detail dict |
| `note_parser.py` | raw_note → tags/warnings/rules/risk |
| `scraper.py` / `detail_scraper.py` | 編排（資料庫 + cache + retry） |
| `audit.py` | 資料品質檢查 |
| `cli.py` | argparse 入口 |

---

## 10. 已知限制

依嚴重度排：

1. **`textbook` 0% 覆蓋**（待 P7 處理）
2. **course_details 只有 57 列**（待 P6 完整跑）
3. **conflict block 並排：interval coloring 不保證最小欄數**——`A: 1-3, B: 2-4, C: 1-2` 最佳解 2 欄但本實作可能 3 欄。spec 已接受。
4. **scheduleStats.dailyLoad.courseCount 跨日各算一次**——「一/3,4 三/3,4」這門課在週一+週三 courseCount 各 +1。spec §15 範例與此語意一致，符合預期。
5. **schedule snapshot 可能 stale**：localStorage 存的是 add-time 的 snapshot；若 capacity / classroom / 教師之後變動，schedule 上看到的是舊資料。換新值要重新加入。capacity/enrolled/remaining 故意不存 snapshot。
6. **/schedule SSR 階段只顯示 loading skeleton**：localStorage 只在 client 可讀，SSR 看不到使用者狀態。這是設計，不是 bug。
7. **no-time 課程不參與衝堂**：論文 / 實習 / 上課時間另訂 一律從 grid 移除，放 sidebar `無時間` tab。即使兩門「上課時間另訂」可能其實衝突，本系統不偵測。
8. **跨 tab 同步靠 `storage` event**：同一 tab 內的兩個 React tree 用 `useSyncExternalStore` 同步，跨 tab 用 `window.addEventListener("storage", ...)`。極罕見的 race condition 不處理。
9. **未做 dark mode 切換 UI**：一直是 dark。`<html className="dark">` hard-coded。Tailwind v4 的 `@theme` 已寫了 dark 色票，但沒切換按鈕。
10. **detail page Hydration race**：`CourseDetailActions` 在 `!hydrated` 時顯示「載入中…」，避免 SSR/CSR mismatch。第一秒可能閃一下空狀態，可接受。

---

## 11. 作者的工作模式偏好

讀完上面後，你還需要知道作者的工作風格——這影響你回覆的長度、頻率、與決策時機。

### 11.1 提案 → 確認 → 動工

對於有架構性影響的決策（schema 改動、資料策略、新依賴、重大 refactor），先**寫提案** + 列 trade-off + 列 2-3 個明確問題 → 等作者逐項確認 → 再動工。**不要靜默執行**。

範例：早期作者本來說「Phase 1 只用 opendata XLS」。AI 抓下來發現只有 9 欄、缺教師時間，**先回報給作者再進場**，提出「改用 /view-dept/」的替代方案。作者確認後才動。**這個 pattern 是必須的**。

對於普通實作（已同意計畫範圍內的小事），不必每個檔案都問——直接做、寫測試、回報。

### 11.2 一口氣完成「一個切片」

作者偏好可驗收的小切片，例如「pure functions + tests + smoke」是一個切片。**不要**做到一半留半成品（例如寫了 layout.ts 但沒寫測試）。

### 11.3 端到端驗收後才宣告完成

每個 priority 結束時要：
1. `npm test` / `pytest` 全綠
2. `npm run typecheck` 乾淨
3. dev server SSR HTTP 200
4. **真實資料**驗證（如 dept 100 的 0001 + 0006）

只有 unit test 通過不算完成。

### 11.4 文件用繁體中文，技術詞英文

回覆 / 報告全用繁中。**不要混用簡中**。

### 11.5 報告長度

每個 priority 的結尾摘要可以詳細（涵蓋設計取捨、tests 統計、SSR 結果、已知限制、下一步建議）。**中間進度不必一直話癆**——一句話「typecheck pass、tests 105/105，準備寫 X」即可。

### 11.6 不要過度泛化

當作者要的功能有固定範圍（如 P7 教材抽取），**不要順手做相關但未請求的功能**（例：別順便做「課程主題分類」）。

### 11.7 發現新問題時的處理

如果在做某 priority 時發現 bug 不在當前 scope，先記錄、不要立刻修。回報時列「發現的副作用」，由作者決定要不要分支處理。

---

## 12. 曾經踩過的雷

避免重蹈覆轍：

### 12.1 better-sqlite3 native build

Node 24 + Windows 沒 prebuilt binary，需 VS Build Tools。**已改用 `node:sqlite`**（Node 22.5+ 內建）。**不要**回 better-sqlite3，除非 node:sqlite 真的不夠用。

### 12.2 node:sqlite 回傳的 row 不是 plain object

React 19 拒絕 serialize 給 client component。`queries.ts` 的 `rowToCourse` / `rowToDetail` / `listTerms` / `listDepartments` 都已用 `{...row}` 或顯式欄位複製攤平。**新查詢要記得這點**。

### 12.3 THU /view-dept/ 時間欄有兩種格式

- Format A：`星期一/3,4[H101] 星期三/5,6[H102]`（空格分隔，各自教室）
- Format B：`星期一/3,4,二/3,4[H305]`（逗號分隔，第二日起無「星期」前綴，共用教室）

舊 regex 只認 Format A，把 Format B 的 `,二/3` 抓進 periods。**parser 已修**（`parse_dept._parse_time_slots`），audit 已加 `corrupt_period_token_count` 檢查防迴歸。

### 12.4 跨學期 courseCode 撞號

兩門課可能 courseCode 相同但 year/semester 不同。早期 `WeeklyGrid` / `ConflictList` / `scheduleStore.confirmCourse` 都用 courseCode 做反查 → 跨學期會混。**已改用 `WeakMap<CourseLike, StoredScheduleCourse>` reference matching**。任何新的 conflict→entry 反查都要走 reference，**不要**用 courseCode-only。

### 12.5 「不開放人工加選」反向誤判

note_parser 早期把「不開放人工加選」誤判為「需要人工加選」（語意完全相反）。**已加 negative-lookbehind**（Python `re` 不支援 variable-width，所以堆疊三個 fixed-width lookbehind：`(?<!不開放)(?<!不得)(?<!禁止)人工加選`）。

未來新增 tag keyword 時，**檢查中文「不」「禁止」「無」這類否定詞會不會反向**。

### 12.6 detail page 的「課程資訊」section 同 row 共享多 h2

THU detail page 的 `<div class="row">` 裡常常塞 4 個 h2（課程資訊 / 參考書目 / 開課紀錄 / 本學期類似課程），它們共用同一個 row。早期用「找 h2 的 parent row」的方式抓 section 內容會把所有 4 個 section 抓成一樣。

**已改用「文件順序在 h2 邊界切片」策略**（`parse_detail._slice_sections`）。新加的 detail page parser 邏輯不要回到 row-based 切片。

### 12.7 detail page 的 `<br>` 不產生 newline

BeautifulSoup `descendants` 不會為 void elements 吐 text。早期 raw_text 把「授課教師：丘為君 張運宗」「大班TA…」全部黏成一行。**已加 `<br>` → `\n` 預處理**。新 parser 要保留這步。

### 12.8 detail page 的 h3 子標題流入內文

「基本資料 / 教師與教學助理 / 授課大綱」是 h3，文字若不剝掉會混入 raw_section text。**已改 `_is_inside_section_heading` 過濾所有 h1-h6**。

### 12.9 console.log 在 `with` 區塊外觸發 closure capture issue

`detail_scraper._build_report` 早期把 closures 留在 `with db.connect()` 區塊外執行 → connection 已關閉。**已改成 inline 完成計算後再 return**。新加的 stats 計算別重蹈。

### 12.10 「query 在不同 cwd 失敗」

當你開新 bash session 切到子目錄後忘記回 root，後續 SQLite 路徑會錯。**用 `cd /c/Users/anson/Documents/GitHub/CCSP-Web && ...`** 重設 cwd。

---

## 附：起手式建議

如果你是被叫來「繼續工作」的下一個 AI，建議的開場順序：

1. 讀這份文件第 1-4 節
2. `cd web && npm test` 確認 105/105 通過、`npm run typecheck` clean
3. `cd importer && python -m pytest tests -q` 確認 48/48 通過
4. 看作者本次 turn 的訊息——通常會明說要做 Priority A / B / C 哪一項
5. 如果要做 Priority A（人工驗收 P5B），照第 3 節步驟做
6. 如果要做新東西，先寫提案（trade-off + 2-3 個確認問題）再動

開工順利。

— P5B 結束時的 AI 留
