from fastapi import FastAPI, UploadFile, HTTPException, File
import asyncio
import re
import random
import httpx

from .config import DOWNLOAD_DIR, get_db_connection
from .llm import generate_json, pdf_part
from .question_bank import ANSWER_STYLE, QUESTIONS_SCHEMA, insert_questions

# Import your existing routers
from .api import (
    syllabus_processing,
    keyword_extraction,
    web_search,
    flashcard_generator,
    practice_exam_creator
)

# Import helper functions for the pipeline
from .api.syllabus_processing import analyze_syllabus, insert_into_db
from .api.web_search import web_search as perform_web_search
from .api.pdf_downloader import download_pdf_file

# The Electron app calls this API from its main process, which is not subject to
# CORS, so no CORS middleware is installed: browser pages can't read responses.
app = FastAPI()

# Create the question bank on startup so the Electron app can open it on a fresh clone
get_db_connection().close()

MAX_DOWNLOADS = 10
# Limit parallel Gemini requests to stay under the free tier's per-minute limits
GEMINI_CONCURRENCY = 2

@app.get("/")
def read_root():
    return {"message": "Welcome to the Study Toolkit API"}

# Include your existing API routers
app.include_router(syllabus_processing.router)
app.include_router(keyword_extraction.router)
app.include_router(web_search.router)
app.include_router(flashcard_generator.router)
app.include_router(practice_exam_creator.router)


def course_folder_name(course_name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", course_name).strip("_") or "course"


async def extract_questions_from_pdf(file_info: dict, course_name: str, topics: list, semaphore: asyncio.Semaphore) -> list:
    pdf_bytes = await asyncio.to_thread(lambda: open(file_info["path"], "rb").read())

    prompt = f"""This document was found online as possible past exam or study material for the
course "{course_name}", which covers these topics: {', '.join(topics)}.

Extract the practice questions from it that would help a student prepare for this course.
Write each question so it stands on its own, including any values or context it needs.
Tag each question with the most relevant topic from the list and a difficulty.
If the document includes answers, use them; otherwise work the answer out yourself.

{ANSWER_STYLE}

If the document contains no usable questions for this course, return an empty list."""

    async with semaphore:
        result = await generate_json([pdf_part(pdf_bytes), prompt], QUESTIONS_SCHEMA)

    questions = result["questions"]
    # Store every question under the exact course name from the syllabus analysis
    for q in questions:
        q["course"] = course_name
        q["source_pdf"] = file_info["source_url"]

    print(f"✓ Extracted {len(questions)} questions from {file_info['filename']}")
    return questions


# Complete Pipeline Endpoint
@app.post("/api/process-syllabus-pipeline/")
async def process_syllabus_pipeline(syllabus: UploadFile = File(...)):
    results = {
        "course_info": {},
        "search_results": {},
        "downloaded_pdfs": [],
        "stored_questions": {}
    }

    try:
        # STEP 1: Process the uploaded syllabus
        print("Step 1: Processing syllabus...")
        try:
            analysis = await analyze_syllabus(await syllabus.read())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        results["course_info"] = analysis

        # IMPORTANT: Use the course_name from Gemini's analysis
        # This is what will be stored in the database
        course_name = analysis.get("course_name", "Unknown Course")
        topics = analysis.get("topics", [])

        insert_into_db(analysis)

        print(f"✓ Course identified: {course_name}")
        print(f"✓ Topics found: {len(topics)}")

        # STEP 2: Search for past exam PDFs
        print("\nStep 2: Searching for past exam PDFs...")
        search_results = await perform_web_search(course_name)
        results["search_results"] = search_results
        print(f"✓ Search completed: {sum(len(v) for v in search_results.values())} PDFs found")

        # STEP 3: Download the PDFs (the same PDF often shows up for several queries)
        print("\nStep 3: Downloading PDFs...")
        candidates = []
        seen_urls = set()
        for links in search_results.values():
            for item in links:
                pdf_url = item.get("link")
                if pdf_url and pdf_url not in seen_urls:
                    seen_urls.add(pdf_url)
                    candidates.append(item)
        candidates = candidates[:MAX_DOWNLOADS]

        course_dir = DOWNLOAD_DIR / course_folder_name(course_name)

        async def download(index: int, item: dict):
            safe_name = f"exam_{index + 1}.pdf"
            file_path = course_dir / safe_name
            try:
                download_result = await download_pdf_file(client, item["link"], file_path)
            except Exception as e:
                print(f"✗ Failed to download {item['link']}: {e}")
                return None
            print(f"✓ Downloaded: {safe_name}")
            return {
                "filename": safe_name,
                "path": str(file_path),
                "source_url": item["link"],
                "title": item.get("title"),
                "size_bytes": download_result.get("size_bytes", 0)
            }

        async with httpx.AsyncClient(timeout=30) as client:
            downloads = await asyncio.gather(*(download(i, item) for i, item in enumerate(candidates)))
        downloaded_files = [d for d in downloads if d]

        results["downloaded_pdfs"] = downloaded_files
        print(f"\n✓ Total PDFs downloaded: {len(downloaded_files)}")

        # STEP 4: Extract questions from downloaded PDFs and store them
        print("\nStep 4: Storing Questions from PDFs into Database...")

        all_questions = []

        if downloaded_files:
            semaphore = asyncio.Semaphore(GEMINI_CONCURRENCY)
            extracted = await asyncio.gather(
                *(extract_questions_from_pdf(f, course_name, topics, semaphore) for f in downloaded_files),
                return_exceptions=True
            )
            for file_info, outcome in zip(downloaded_files, extracted):
                if isinstance(outcome, Exception):
                    print(f"✗ Error processing {file_info['filename']}: {outcome}")
                else:
                    all_questions.extend(outcome)

            random.shuffle(all_questions)

            results["stored_questions"] = {
                "course_name": course_name,
                "topics": topics,
                "total_questions": len(all_questions),
                "questions": all_questions[:20],
                "sources": [f["source_url"] for f in downloaded_files]
            }

            # --- SAVE QUESTIONS TO DATABASE ---
            if all_questions:
                insert_questions(all_questions)
                print(f"✓ {len(all_questions)} questions stored to database under course: '{course_name}'")
            else:
                print("⚠ No questions extracted from PDFs")

        else:
            results["stored_questions"] = {
                "total_questions": 0,
                "message": "No PDFs downloaded, cannot find questions"
            }

        return {
            "success": True,
            "message": "Pipeline completed successfully",
            "course_name": course_name,  # Return this so frontend knows the exact course name
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    # Localhost only: the API has no authentication
    uvicorn.run(app, host="127.0.0.1", port=8000)
