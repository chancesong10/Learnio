from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import tempfile
import os
import requests
import json
import random
from google import genai
from google.genai import types
import sqlite3
from pathlib import Path

load_dotenv('.env.local')  # Load environment variables from .env.local

# Import your existing routers
from .api import (
    syllabus_processing, 
    keyword_extraction, 
    web_search, 
    pdf_downloader, 
    flashcard_generator, 
    practice_exam_creator
)

# Import helper functions for the pipeline
from .api.syllabus_processing import extract_text_from_pdf, analyze_syllabus_with_gemini
from .api.pdf_downloader import download_pdf_file

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Study Toolkit API"}

# Include your existing API routers
app.include_router(syllabus_processing.router)
app.include_router(keyword_extraction.router)
app.include_router(web_search.router)
app.include_router(pdf_downloader.router)
app.include_router(flashcard_generator.router)
app.include_router(practice_exam_creator.router)


# --- HELPER: Insert questions into SQLite database ---
def insert_questions_into_db(questions: list):
    project_root = Path(__file__).resolve().parents[2]  # adjust to match your folder structure
    db_path = project_root / "data" / "question_bank.sqlite"

    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Ensure questions table exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_text TEXT NOT NULL,
            course TEXT,
            topics TEXT,
            difficulty TEXT,
            source_pdf TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(question_text, course)
        )
    """)

    for q in questions:
        question_text = q.get("question") or ""
        course = q.get("course") or ""
        topics = q.get("topic") or ""
        difficulty = q.get("difficulty") or ""
        source_pdf = q.get("source_pdf") or ""

        c.execute("""
            INSERT OR IGNORE INTO questions
            (question_text, course, topics, difficulty, source_pdf)
            VALUES (?, ?, ?, ?, ?)
        """, (question_text, course, topics, difficulty, source_pdf))

    conn.commit()
    conn.close()
    print(f"✓ {len(questions)} questions inserted into database")


# NEW: Complete Pipeline Endpoint
@app.post("/api/process-syllabus-pipeline/")
async def process_syllabus_pipeline(syllabus: UploadFile = File(...)):
    results = {
        "course_info": {},
        "search_results": {},
        "downloaded_pdfs": [],
        "practice_exam": {}
    }

    try:
        # STEP 1: Process the uploaded syllabus
        print("Step 1: Processing syllabus...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await syllabus.read()
            temp_file.write(content)
            temp_path = temp_file.name

        syllabus_text = extract_text_from_pdf(temp_path)
        analysis = await analyze_syllabus_with_gemini(syllabus_text)

        results["course_info"] = analysis
        course_name = analysis.get("course_name", "Unknown Course")
        topics = analysis.get("topics", [])

        print(f"✓ Course identified: {course_name}")
        print(f"✓ Topics found: {len(topics)}")

        os.unlink(temp_path)

        # STEP 2: Search for past exam PDFs
        print("\nStep 2: Searching for past exam PDFs...")
        from .api.web_search import web_search as perform_web_search
        search_results = await perform_web_search(course_name)
        results["search_results"] = search_results
        print(f"✓ Search completed: {sum(len(v) for v in search_results.values())} PDFs found")

        # STEP 3: Download the PDFs
        print("\nStep 3: Downloading PDFs...")
        os.makedirs("downloaded_exams", exist_ok=True)
        downloaded_files = []
        download_count = 0
        max_downloads = 3

        for query, links in search_results.items():
            for item in links[:max_downloads]:
                if download_count >= max_downloads:
                    break
                pdf_url = item.get("link")
                if pdf_url:
                    try:
                        safe_name = f"exam_{download_count + 1}.pdf"
                        file_path = os.path.join("downloaded_exams", safe_name)
                        download_result = download_pdf_file(pdf_url, file_path)
                        downloaded_files.append({
                            "filename": safe_name,
                            "path": file_path,
                            "source_url": pdf_url,
                            "title": item.get("title"),
                            "size_bytes": download_result.get("size_bytes", 0)
                        })
                        download_count += 1
                        print(f"✓ Downloaded: {safe_name}")
                    except Exception as e:
                        print(f"✗ Failed to download {pdf_url}: {str(e)}")
                        continue
            if download_count >= max_downloads:
                break

        results["downloaded_pdfs"] = downloaded_files
        print(f"\n✓ Total PDFs downloaded: {len(downloaded_files)}")

        # STEP 4: Create practice exam from downloaded PDFs
        print("\nStep 4: Creating practice exam...")

        all_questions = []

        if downloaded_files:
            client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

            for file_info in downloaded_files:
                try:
                    pdf_text = extract_text_from_pdf(file_info["path"])
                    prompt = f"""
Analyze this past exam content for the course "{course_name}" covering topics: {', '.join(topics)}.

Extract 5-10 practice questions that would help students prepare for this course.

Format your response as JSON with this structure:
{{
    "questions": [
        {{"question": "The question text",
          "course": "{course_name}",
          "difficulty": "easy", "medium", or "hard",
          "topic": "relevant topic from the list"}}
    ]
}}

Exam content (first 3000 characters):
{pdf_text[:3000]}
"""
                    response = await client.aio.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )

                    result = json.loads(response.text)
                    questions = result.get("questions", [])

                    # Add source_pdf info
                    for q in questions:
                        q["source_pdf"] = file_info["filename"]

                    all_questions.extend(questions)
                except Exception as e:
                    print(f"Error processing {file_info['filename']}: {str(e)}")
                    continue

            random.shuffle(all_questions)

            results["practice_exam"] = {
                "course_name": course_name,
                "topics": topics,
                "total_questions": len(all_questions),
                "questions": all_questions[:20],
                "sources": [f["filename"] for f in downloaded_files]
            }

            # --- SAVE QUESTIONS TO DATABASE ---
            insert_questions_into_db(all_questions)

            print(f"✓ Practice exam created with {len(all_questions)} questions")
        else:
            results["practice_exam"] = {
                "message": "No PDFs downloaded, cannot create practice exam"
            }

        return {
            "success": True,
            "message": "Pipeline completed successfully",
            "results": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
