import sys
import asyncio

# ----- FIX WINDOWS ASYNCIO BUG -----
# Forces Python to use the stable SelectorEventLoop on Windows
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# -----------------------------------

import json
import PyPDF2
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncio
from google import genai
from google.genai import types
from fastapi import APIRouter
import sqlite3
from typing import List

router = APIRouter()

# Load .env from the project root
env_path = Path(__file__).parent.parent.parent.parent / '.env.local'
load_dotenv(env_path)

# Initialize Gemini API client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Extract text from a PDF file
def extract_text_from_pdf(pdf_path: str) -> str:
    with open(pdf_path, "rb") as f:
        pdf_reader = PyPDF2.PdfReader(f)
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()

# Async function to analyze syllabus using Gemini
async def analyze_syllabus_with_gemini(text: str) -> dict:
    prompt = f"""
Analyze the following course syllabus and extract:

1. Course name: Provide a clear, descriptive course name WITHOUT the course code.
   - Good examples: "Matrix Algebra", "Introduction to Modern Biology", "Differential Calculus with Applications"
   - Bad examples: "MATH221", "BIOL 111", "MATH 101"
   
2. Topics that will be quizzed on: List each topic concisely (no more than 3 words per topic)

IMPORTANT: The course name you provide will be used to store and retrieve practice questions, so make it descriptive and consistent.

Format your response as JSON with this exact structure:
{{
    "course_name": "Descriptive course name without code",
    "topics": ["Topic 1", "Topic 2", "Topic 3"]
}}

Syllabus text:
{text[:4000]}
"""
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    try:
        analysis = json.loads(response.text)

        if not analysis.get("course_name"):
            analysis["course_name"] = "Unknown Course"

        if not isinstance(analysis.get("topics"), list):
            analysis["topics"] = []

        print(f"[Gemini Analysis] Course: {analysis['course_name']}, Topics: {len(analysis['topics'])}")

    except Exception as e:
        print("Raw Gemini output:", response.text)
        print(f"Exception occurred: {type(e).__name__} - {e}")
        analysis = {
            "course_name": "Unknown Course",
            "topics": []
        }

    return analysis

# Insert analysis into SQLite database
def insert_into_db(analysis: dict):
    project_root = Path(__file__).resolve().parents[3]
    db_path = project_root / "data" / "question_bank.sqlite"

    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at: {db_path}")

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Ensure courses table exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course TEXT UNIQUE,
            topics TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    course_name = analysis.get("course_name", "Unknown Course")
    topics = analysis.get("topics", [])
    topics_str = ", ".join(topics)

    c.execute("""
        INSERT OR REPLACE INTO courses (course, topics)
        VALUES (?, ?)
    """, (course_name, topics_str))

    conn.commit()
    conn.close()

    print("[OK] Saved to database:", file=sys.stderr)
    print(f"  Course: {course_name}", file=sys.stderr)
    print(f"  Topics: {len(topics)} topics", file=sys.stderr)

# Main function
async def main():
    if len(sys.argv) < 2:
        print("Usage: python syllabus_processing.py <path_to_pdf>")
        sys.exit(1)

    syllabus_file = sys.argv[1]
    text = extract_text_from_pdf(syllabus_file)
    analysis = await analyze_syllabus_with_gemini(text)

    output = {**analysis}
    print(json.dumps(output, indent=4))

    insert_into_db(analysis)

if __name__ == "__main__":
    asyncio.run(main())
