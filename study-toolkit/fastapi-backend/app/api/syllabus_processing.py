import sys
import asyncio
import json
from pathlib import Path
from fastapi import APIRouter

from ..config import get_db_connection
from ..llm import generate_json, pdf_part

router = APIRouter()

SYLLABUS_SCHEMA = {
    "type": "object",
    "properties": {
        "course_name": {"type": "string"},
        "topics": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["course_name", "topics"],
    "additionalProperties": False,
}

def syllabus_content(data: bytes):
    """Pass PDFs to Gemini as documents and anything else as plain text."""
    if data.startswith(b"%PDF"):
        return pdf_part(data)
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("Unsupported syllabus format: upload a PDF or a plain-text file")
    return f"<syllabus>\n{text}\n</syllabus>"

# Analyze a syllabus (PDF or text bytes) with Gemini
async def analyze_syllabus(data: bytes) -> dict:
    prompt = """Read this course syllabus and extract:

1. Course name: a clear, descriptive course name without the course code, for example
   "Matrix Algebra" or "Introduction to Modern Biology" rather than "MATH221" or "BIOL 111".
   It is used to store and look up practice questions, so keep it descriptive and consistent.

2. Topics that will be quizzed on, each no more than 3 words."""

    analysis = await generate_json(
        [syllabus_content(data), prompt],
        SYLLABUS_SCHEMA,
    )

    analysis["course_name"] = analysis["course_name"].strip() or "Unknown Course"
    analysis["topics"] = [t.strip() for t in analysis["topics"] if t.strip()]

    # Debug output goes to stderr so stdout stays pure JSON in CLI mode
    print(f"[Gemini Analysis] Course: {analysis['course_name']}, Topics: {len(analysis['topics'])}", file=sys.stderr)
    return analysis

# Insert analysis into SQLite database
def insert_into_db(analysis: dict):
    course_name = analysis.get("course_name", "Unknown Course")
    topics = analysis.get("topics", [])
    topics_str = ", ".join(topics)

    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO courses (course, topics)
            VALUES (?, ?)
        """, (course_name, topics_str))
        conn.commit()
    finally:
        conn.close()

    print("[OK] Saved to database:", file=sys.stderr)
    print(f"  Course: {course_name}", file=sys.stderr)
    print(f"  Topics: {len(topics)} topics", file=sys.stderr)

# CLI entry point: python -m app.api.syllabus_processing <path_to_syllabus>
async def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.api.syllabus_processing <path_to_syllabus>", file=sys.stderr)
        sys.exit(1)

    analysis = await analyze_syllabus(Path(sys.argv[1]).read_bytes())

    # Only JSON output goes to stdout
    print(json.dumps(analysis, indent=4))

    insert_into_db(analysis)

if __name__ == "__main__":
    # The default Proactor loop on Windows raises "Event loop is closed" on exit
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
