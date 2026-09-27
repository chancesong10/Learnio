import os
import sys
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

# Log messages contain ✓/✗; on Windows, redirected output defaults to cp1252,
# which can't encode them and would crash the request that prints them
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

# study-toolkit/ — every path below is resolved from here, never from the cwd
PROJECT_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(PROJECT_ROOT / ".env.local")

DB_PATH = PROJECT_ROOT / "data" / "question_bank.sqlite"
DOWNLOAD_DIR = PROJECT_ROOT / "downloaded_exams"

# Any Gemini model with a free tier works, e.g. gemini-3.8-flash or gemini-3.5-flash-lite
GEMINI_MODEL = os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Add it to {PROJECT_ROOT / '.env.local'}")
    return value


def get_db_connection() -> sqlite3.Connection:
    """Open the question bank, creating the file and tables on first use."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_text TEXT NOT NULL,
            course TEXT,
            topics TEXT,
            difficulty TEXT,
            source_pdf TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(question_text, course)
        );
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course TEXT UNIQUE,
            topics TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Older databases predate answers; add the columns in place
    columns = {row[1] for row in conn.execute("PRAGMA table_info(questions)")}
    for column in ("answer", "explanation"):
        if column not in columns:
            conn.execute(f"ALTER TABLE questions ADD COLUMN {column} TEXT")
    return conn
