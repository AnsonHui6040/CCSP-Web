-- CCSP Web SQLite schema (Phase 1)
-- Source: course.thu.edu.tw /view-dept/ HTML tables
-- Re-run is idempotent: tables use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS courses (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,

  -- identity
  year                 INTEGER NOT NULL,           -- 學年 e.g. 114
  semester             INTEGER NOT NULL,           -- 學期 1 / 2
  course_code          TEXT    NOT NULL,           -- 選課代碼 e.g. "0001"

  -- naming
  course_name          TEXT    NOT NULL,           -- 中文課名 (selected/required prefix stripped)
  course_name_en       TEXT,                       -- 英文課名

  -- classification
  required_or_elective TEXT,                       -- 選修 / 必修 / 通識 / etc.
  credits_raw          TEXT,                       -- "3-0" raw token from HTML
  credits_lecture      REAL,                       -- 學分 (講授)
  credits_lab          REAL,                       -- 學分 (實習)
  credits_total        REAL,                       -- lecture + lab (computed)

  -- offering unit
  dept_code            TEXT,                       -- 開課系所代碼 e.g. "100"
  dept_name            TEXT,                       -- 開課系所名稱 e.g. "文學院"

  -- teaching
  teachers_json        TEXT,                       -- JSON: [{"name":"丘為君","slug":"echiu"}, ...]

  -- schedule (rendered for humans + parsed for layout)
  time_raw             TEXT,                       -- "星期四/7,8,9[LAN013] 星期一/3,4[M101]"
  time_slots_json      TEXT,                       -- JSON: [{"weekday":4,"periods":[7,8,9],"classroom":"LAN013"}, ...]

  -- enrollment
  capacity             INTEGER,                    -- 上限
  enrolled             INTEGER,                    -- 現選
  remaining            INTEGER,                    -- 餘額

  -- raw note + structured derivations
  raw_note             TEXT,
  tags_json            TEXT,                       -- JSON: ["english_taught","remote",...]
  warnings_json        TEXT,                       -- JSON: [{type,level,message}, ...]
  rules_json           TEXT,                       -- JSON: [{type,value,source}, ...]
  risk_level           TEXT,                       -- "low" | "medium" | "high"

  -- xref
  course_profile_id    TEXT,                       -- /course-profile/{id} historical record id

  -- bookkeeping
  scraped_at           TEXT NOT NULL,              -- ISO8601 UTC

  UNIQUE (year, semester, course_code)
);

CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses (year, semester);
CREATE INDEX IF NOT EXISTS idx_courses_code     ON courses (course_code);
CREATE INDEX IF NOT EXISTS idx_courses_dept     ON courses (dept_code);
CREATE INDEX IF NOT EXISTS idx_courses_name     ON courses (course_name);

-- Per-department scrape audit so we can diff and resume.
CREATE TABLE IF NOT EXISTS scrape_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  year          INTEGER NOT NULL,
  semester      INTEGER NOT NULL,
  dept_code     TEXT    NOT NULL,
  dept_name     TEXT,
  course_count  INTEGER NOT NULL DEFAULT 0,
  http_status   INTEGER,
  scraped_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_term ON scrape_runs (year, semester, dept_code);

-- Singleton meta for schema version + last-import timestamps.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ----------------------------------------------------------------------
-- Phase 4: per-course detail page (course.thu.edu.tw/view/{y}/{s}/{code})
--
-- Kept in its own table so the courses row stays narrow and so a parser
-- bump can re-process from raw_sections_json without touching the main
-- table.
CREATE TABLE IF NOT EXISTS course_details (
  year                     INTEGER NOT NULL,
  semester                 INTEGER NOT NULL,
  course_code              TEXT    NOT NULL,

  detail_url               TEXT,                  -- absolute URL
  course_description       TEXT,                  -- 課程概述
  teaching_goal            TEXT,                  -- 教育目標
  grading_policy_json      TEXT,                  -- JSON: [{item,percent,note}]
  textbook                 TEXT,                  -- 教材 (rare; usually null)
  reference_books          TEXT,                  -- 參考書目
  office_hour              TEXT,                  -- Office Hour 文字段
  syllabus_url             TEXT,                  -- 授課大綱 link (absolute)
  detailed_note            TEXT,                  -- 選課備註 (more verbose than dept page)
  teachers_json            TEXT,                  -- JSON: [{name,slug}]
  teaching_assistants_json TEXT,                  -- JSON: [{name}]
  raw_sections_json        TEXT,                  -- JSON: {section_name: text}

  fetched_at               TEXT NOT NULL,         -- ISO8601 UTC
  parser_version           TEXT,                  -- e.g. "detail_parser_v1"
  fetch_status             TEXT NOT NULL,         -- success/skipped/parse_error/http_error/not_found
  error_message            TEXT,

  PRIMARY KEY (year, semester, course_code)
);

CREATE INDEX IF NOT EXISTS idx_course_details_status   ON course_details (fetch_status);
CREATE INDEX IF NOT EXISTS idx_course_details_term     ON course_details (year, semester);

CREATE TABLE IF NOT EXISTS detail_scrape_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  year          INTEGER NOT NULL,
  semester      INTEGER NOT NULL,
  course_code   TEXT    NOT NULL,
  http_status   INTEGER,
  fetch_status  TEXT,
  error_message TEXT,
  scraped_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detail_runs_term ON detail_scrape_runs (year, semester, course_code);
