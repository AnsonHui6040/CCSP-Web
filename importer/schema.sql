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
