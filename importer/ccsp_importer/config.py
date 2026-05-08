"""Project-wide constants for the importer."""
from __future__ import annotations

from pathlib import Path

# Repo paths -----------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
DB_PATH = DATA_DIR / "ccsp.sqlite"
SCHEMA_PATH = REPO_ROOT / "importer" / "schema.sql"

# THU endpoints --------------------------------------------------------------
BASE = "https://course.thu.edu.tw"
OPENDATA_LIST_URL = BASE + "/opendatadownload/list/{year}/{sem}/"
DEPT_LIST_URL = BASE + "/view-dept/{year}/{sem}/{dept}/"
COURSE_DETAIL_URL = BASE + "/view/{year}/{sem}/{code}"

# Scraping etiquette ---------------------------------------------------------
USER_AGENT = (
    "CCSP-Web/0.1 (+https://github.com/AnsonHui6040/CCSP-Web; "
    "non-commercial student-tool; contact: course@thu.edu.tw via web)"
)
REQUEST_TIMEOUT_SEC = 20
REQUEST_DELAY_SEC = 1.5

# opendata CSV is served as Big5 even though it's named .xls.
OPENDATA_ENCODING = "big5"
