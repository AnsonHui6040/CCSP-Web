# CCSP Web

**Course Choice & Schedule Planner Web** — 大學課程選擇與課表編排工具

CCSP Web is a course search and timetable planning tool built on publicly available course data.  
CCSP Web 是一個基於公開課程資料的課程查詢、候選課程整理與課表編排工具。

Currently targeting: **Tunghai University** (東海大學) — [course.thu.edu.tw](https://course.thu.edu.tw/)

## Creators / 製作者

- [AnsonHui6040](https://github.com/AnsonHui6040)
- [MrLongMo](https://github.com/MrLongMo)

## Production Statement / 製作聲明

CCSP Web is a student-oriented course search and schedule planning project created for learning, reference, and personal timetable planning. It is independently developed and maintained by the creators listed above.

CCSP Web 是由上述製作者共同製作的選課查詢與課表規劃工具，目的為協助學生整理公開課程資訊、建立候選課程與預排課表。本專案為獨立製作，並非學校官方系統或官方服務。

## Legal Disclaimer / 法律免責聲明

This project is provided for informational and planning purposes only. Course availability, quota, classroom, schedule, teacher, grading policy, syllabus, and all other academic information may change without notice. Users must verify final and official information through Tunghai University's official course selection and academic systems.

本專案資料僅供查詢、整理與課表規劃參考。課程名額、時間、教室、教師、評分方式、授課大綱及其他教務資訊均可能異動；所有正式資訊與選課結果，應以東海大學官方系統與公告為準。

This project does not provide course registration, does not guarantee successful enrollment, does not represent Tunghai University, and does not assume responsibility for losses, missed registration opportunities, schedule conflicts, data errors, or decisions made based on this tool.

本專案不提供自動選課、加退選或登入學校系統功能，不保證選課成功，不代表東海大學立場，亦不對因使用本工具所造成之資料誤差、選課判斷、衝堂、未成功選課或其他損失負責。

---

## 1. Project Overview

CCSP Web helps students search courses, build a candidate pool, plan their weekly timetable, and detect scheduling conflicts — all without logging into the school's registration system.

- **Course search**: filter by keyword, department, weekday, and more
- **Candidate pool**: shortlist courses before committing to a schedule
- **Schedule planner**: arrange courses in a weekly grid, check for conflicts
- **Course details**: view teaching objectives, grading, and syllabus (fetched on demand)
- **Export**: save your timetable as PNG or PDF

This project does **not** log into the university system, does **not** perform automated registration, and does **not** bypass any authentication or access control.

> CCSP Web is not affiliated with, sponsored by, or endorsed by Tunghai University.  
> CCSP Web 並非東海大學官方服務，亦不代表學校立場。

---

## 2. Features

### Course Search
- Query by academic year and semester
- Full-text keyword search
- Filter by department, weekday, remaining seats, and risk level
- Display teacher, time, classroom, credits, seat availability, and notes

### Candidate Pool
- Add courses to a personal candidate pool
- Manage candidates from the schedule page
- Pool data persisted in `localStorage` (browser-local)

### Schedule Planner
- **Planning mode** — preview and compare candidate courses; shows risk labels, conflict warnings, and unscheduled course list
- **Official mode** — clean final timetable view; shows only course name, teacher, and classroom
- Period support: 0, 1–13, 4.5; weekdays Mon–Sun
- Conflict analysis and credit statistics

### Course Details
- Per-course detail page with teaching objectives, grading breakdown, materials, reference books, and Office Hours
- Details are fetched on demand and cached; manual refresh available from the detail page

### Export
- PNG export
- PDF export
- Export content follows the current timetable mode (planning or official)

---

## 3. Data Source and Compliance

| Item | Detail |
|---|---|
| Data source | Tunghai University public course information pages |
| Access method | Public HTTP pages only — no login, no session tokens |
| Request rate | Throttled (≥ 1.5 s between requests); not used for high-frequency monitoring |
| Automated registration | **Not supported, not planned** |
| Data freshness | Main course data can be refreshed daily; detail data is fetched on demand |

Course data is for reference and planning purposes only. Actual registration results are determined by the university's official system.

This project is not affiliated with, sponsored by, or endorsed by Tunghai University.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Database | SQLite via Node.js built-in `node:sqlite` |
| Importer | Python 3, `requests`, `BeautifulSoup4`, CSV / HTML parsing |
| Export | `html-to-image`, `jsPDF` |
| Testing | Vitest (frontend), pytest (importer) |

---

## 5. Project Structure

```
CCSP-Web/
├── web/
│   ├── app/            # Next.js App Router pages and API routes
│   ├── components/     # React components
│   ├── lib/            # Shared utilities, DB access, schedule logic
│   └── package.json
├── importer/
│   ├── ccsp_importer/  # Python scraper and parser modules
│   └── tests/
├── data/               # SQLite database (git-ignored)
├── scripts/            # Data update shell scripts
├── docs/               # Specification notes
└── README.md
```

---

## 6. Getting Started

### Prerequisites
- Node.js 20+
- Python 3.10+

### Install Web Dependencies

```bash
cd web
npm install
```

### Start Development Server

```bash
cd web
npm run dev
```

The app is available at `http://localhost:3000`.

### Type Check

```bash
cd web
npx tsc --noEmit
```

### Run Tests

```bash
cd web
npx vitest run --pool threads
```

---

## 7. Import Course Data

```bash
cd importer
pip install -r requirements.txt

# Initialise the database (first run only)
python -m ccsp_importer.cli init-db

# Scrape main course list
python -m ccsp_importer.cli scrape --year 114 --semester 2

# Parse structured notes (prerequisite info, restrictions, etc.)
python -m ccsp_importer.cli parse-notes --year 114 --semester 2
```

Please throttle requests responsibly and avoid placing unnecessary load on the source website.

---

## 8. Data Update Strategy

| Data type | Update strategy |
|---|---|
| Main course data (name, teacher, time, classroom, seats, notes) | Can be scheduled daily |
| Course detail data (objectives, grading, syllabus, Office Hours) | Fetched on demand per course; manual refresh from detail page |

Course detail data is **not** auto-fetched for all courses. The system records the last fetch time and shows a notice when data is older than 3 days, but does not automatically re-fetch.

**Not supported:**
- High-frequency seat monitoring
- Automatic or scheduled full detail scraping
- Automated registration of any kind

---

## 9. Schedule Modes

### Planning Mode
- Preview and arrange candidate courses
- Shows risk labels, conflict warnings, and candidate indicators
- Includes an "unscheduled courses" section for courses without a fixed time slot
- Intended for drafting and comparison

### Official Mode
- Clean timetable view for final review and export
- Each cell shows only course name, teacher, and classroom
- No planning annotations or candidate labels
- Unscheduled course section hidden

---

## 10. Export

The timetable can be exported as:

- **PNG** — raster image of the current timetable grid
- **PDF** — printable PDF using the same layout

Export content reflects the currently active mode (planning or official).

---

## 11. Known Limitations

- The scraper and parser are designed for Tunghai University's course website HTML structure. If the site structure changes, the importer may need to be updated.
- Seat availability is not real-time; it reflects the last scraped data.
- Course detail data requires a manual fetch per course and is not guaranteed to be current.
- `localStorage` data is browser-local and is not synced across devices or browsers.
- This tool is not an official registration system.

---

## 12. Roadmap

- Shareable schedule link
- ICS / Google Calendar export
- Enhanced course comparison view
- Multi-semester data management UI
- Improved mobile timetable display
- Abstraction layer for multiple university data sources

---

## 13. License

This project currently has no explicit license. Please contact the maintainer before reuse.
