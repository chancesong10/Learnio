from pathlib import Path
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random

router = APIRouter()

class PracticeExamRequest(BaseModel):
    course: str
    topics: Optional[List[str]] = []
    num_questions: Optional[int] = 20

@router.post("/create-practice-exam/")
def create_practice_exam(req: PracticeExamRequest):
    try:
        # Correct relative path from this file
        db_path = Path(__file__).parents[3] / "data" / "question_bank.sqlite"
        print("Connecting to DB at:", db_path.resolve())

        # Convert Path to string for sqlite3
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # Debug: Show what we're searching for
        print(f"Searching for course: '{req.course}'")
        print(f"Searching for topics: {req.topics}")

        # First, check what courses exist
        c.execute("SELECT DISTINCT course FROM questions")
        available_courses = [row['course'] for row in c.fetchall()]
        print(f"Available courses in DB: {available_courses}")

        # Fetch questions with case-insensitive and partial matching
        questions = []
        
        if not req.topics:
            # Get all questions for this course (case-insensitive)
            c.execute(
                "SELECT * FROM questions WHERE LOWER(course) LIKE LOWER(?)",
                (f"%{req.course}%",)
            )
            questions = c.fetchall()
            print(f"Found {len(questions)} questions for course '{req.course}'")
        else:
            # Get questions matching course and topics
            for topic in req.topics:
                c.execute(
                    """SELECT * FROM questions 
                       WHERE LOWER(course) LIKE LOWER(?) 
                       AND LOWER(topics) LIKE LOWER(?)""",
                    (f"%{req.course}%", f"%{topic}%")
                )
                topic_questions = c.fetchall()
                questions.extend(topic_questions)
                print(f"Found {len(topic_questions)} questions for topic '{topic}'")

        conn.close()

        if not questions:
            # Provide helpful error message
            error_msg = f"No questions found for course '{req.course}'"
            if req.topics:
                error_msg += f" with topics: {req.topics}"
            error_msg += f"\n\nAvailable courses: {', '.join(available_courses)}"
            raise HTTPException(status_code=404, detail=error_msg)

        # Remove duplicates by question_text
        unique_questions = list({q["question_text"]: dict(q) for q in questions}.values())
        print(f"After deduplication: {len(unique_questions)} unique questions")

        # Shuffle
        random.shuffle(unique_questions)

        # Limit number of questions
        num_to_return = min(req.num_questions or 20, len(unique_questions))
        selected_questions = unique_questions[:num_to_return]
        
        print(f"Returning {len(selected_questions)} questions")
        return selected_questions

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR in create_practice_exam:", e)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    
