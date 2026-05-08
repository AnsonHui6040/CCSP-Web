# CCSP Web — Course Choice & Schedule Planner

東海大學選課規劃平台。**這不是課程查詢器**，而是介於 Google Calendar、Notion、選課助手之間的決策工具：候選池、預排課表、衝堂分析、選課風險提示。

## Repository Layout

```
CCSP-Web/
├── web/          Next.js 15 App Router + TS + Tailwind 前端
├── importer/     Python 3 抓取 / 解析 / 匯入腳本
├── data/         SQLite 資料庫 (ccsp.sqlite) — git-ignored
└── docs/         研究筆記、HTML sample
```

## Data Strategy

| 階段 | 主資料來源 | 用途 |
|---|---|---|
| Phase 1 | `course.thu.edu.tw/view-dept/{year}/{sem}/{dept_code}/` | 課程列表（時間/教師/教室/名額/備註） |
| Phase 1 | `course.thu.edu.tw/opendatadownload/list/{year}/{sem}/` | **僅取系所代碼索引**（學期變動穩定） |
| Phase 2 | `course.thu.edu.tw/view/{year}/{sem}/{course_code}` | 評分方式、教學目標、教材、Office Hour、Syllabus |
| Phase 3 | 定期 diff | 名額/教室/時間變動、停開課程 |

**抓取規範**：每 request 間隔 1.5s，固定 User-Agent，僅公開頁面，不登入、不繞過驗證、不抓選課系統內部資料。

## Quick Start

```bash
# Importer
cd importer
pip install -r requirements.txt
python -m ccsp_importer.cli scrape --year 114 --semester 1

# Web
cd ../web
npm install
npm run dev
```

## Phase 1 MVP Scope

- [x] Repo scaffolding
- [ ] SQLite schema
- [ ] /view-dept/ scraper + HTML parser
- [ ] Course import to SQLite
- [ ] /courses 搜尋頁
- [ ] 課程卡片
- [ ] 候選池（localStorage）

## Out of Scope (do not build)

- 自動登入 / 自動搶課
- 高頻名額監控
- AI 推薦課表
- 雲端同步 / 帳號系統

詳見 `docs/spec.md`。
