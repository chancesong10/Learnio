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

        # Fetch questions
        questions = []
        if not req.topics:
            c.execute("SELECT * FROM questions WHERE course=?", (req.course,))
            questions = c.fetchall()
        else:
            for topic in req.topics:
                c.execute(
                    "SELECT * FROM questions WHERE course=? AND topics LIKE ?",
                    (req.course, f"%{topic}%")
                )
                questions.extend(c.fetchall())

        conn.close()

        if not questions:
            raise HTTPException(status_code=404, detail="No questions found for this course/topics")

        # Remove duplicates by question_text
        unique_questions = list({q["question_text"]: q for q in questions}.values())

        # Shuffle
        random.shuffle(unique_questions)

        # Limit number of questions
        num_to_return = min(req.num_questions or 20, len(unique_questions))
        return list(unique_questions)[:num_to_return]

    except Exception as e:
        print("ERROR in create_practice_exam:", e)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
