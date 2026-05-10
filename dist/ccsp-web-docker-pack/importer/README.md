# CCSP Importer

抓取 [course.thu.edu.tw](https://course.thu.edu.tw/) 公開資料並寫入 SQLite。

## Install

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Initialize the SQLite schema (idempotent)
python -m ccsp_importer.cli init-db

# Scrape one full semester (~50 dept pages, ~1.5 min @ 1.5s delay)
python -m ccsp_importer.cli scrape --year 114 --semester 1

# Scrape only specific departments (smoke testing)
python -m ccsp_importer.cli scrape --year 114 --semester 1 --dept 100 --dept 110
```

The DB lives at `../data/ccsp.sqlite` and is shared with the `web/` Next.js app.

## Module Layout

| File | Responsibility |
|---|---|
| `config.py` | URL templates, paths, polite-scrape constants |
| `http_client.py` | `PoliteSession` — single host, fixed UA, 1.5 s delay |
| `models.py` | `Course`, `Teacher`, `TimeSlot` dataclasses |
| `opendata.py` | Read Big5 CSV, return unique dept-code index |
| `parse_dept.py` | BeautifulSoup parser for `/view-dept/` HTML |
| `db.py` | SQLite I/O (upsert by `(year,sem,course_code)`) |
| `scraper.py` | Top-level orchestration |
| `cli.py` | `python -m ccsp_importer.cli ...` |
| `schema.sql` | DB schema, applied on `init-db` |

## Etiquette

- 1.5 s delay between requests, single host
- Fixed `User-Agent` identifying the project
- Public pages only — no login, no enrollment-system endpoints
- HTML responses are cached under `data/raw/{year}-{sem}/dept-{code}.html` for re-parsing without re-fetching
