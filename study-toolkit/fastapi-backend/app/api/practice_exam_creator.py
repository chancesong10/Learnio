import sqlite3
import random
import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from ..config import get_db_connection
from ..question_bank import answer_questions, generate_questions

router = APIRouter()

MAX_QUESTIONS = 50

class PracticeExamRequest(BaseModel):
    course: str
    topics: List[str] = []
    num_questions: int = Field(default=10, ge=1, le=MAX_QUESTIONS)


def load_bank(course: str, topics: List[str]) -> tuple[list, list]:
    """Return (matching question rows, the course's known topics)."""
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    try:
        # Course names are stored exactly as Gemini produced them, so match the
        # whole name (case-insensitive) rather than a substring — otherwise
        # "Calculus" would also pull in "Calculus II" questions
        if topics:
            clauses = " OR ".join("topics LIKE ?" for _ in topics)
            rows = conn.execute(
                f"SELECT * FROM questions WHERE course = ? COLLATE NOCASE AND ({clauses})",
                (course, *[f"%{t}%" for t in topics]),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM questions WHERE course = ? COLLATE NOCASE", (course,)).fetchall()

        course_row = conn.execute("SELECT topics FROM courses WHERE course = ? COLLATE NOCASE", (course,)).fetchone()
        known_topics = [t.strip() for t in (course_row["topics"] if course_row else "").split(",") if t.strip()]
    finally:
        conn.close()

    # Deduplicate by question text
    unique = list({r["question_text"]: dict(r) for r in rows}.values())
    return unique, known_topics


def to_exam_question(row: dict) -> dict:
    return {
        "id": row["id"],
        "question": row["question_text"],
        "topic": row.get("topics") or "",
        "difficulty": row.get("difficulty") or "",
        "answer": row.get("answer") or "",
        "explanation": row.get("explanation") or "",
        "source": row.get("source_pdf") or "",
    }


@router.post("/create-practice-exam/")
async def create_practice_exam(req: PracticeExamRequest):
    bank, known_topics = load_bank(req.course, req.topics)
    random.shuffle(bank)
    selected = bank[:req.num_questions]
    print(f"Practice exam for '{req.course}': {len(selected)} of {req.num_questions} from the question bank")

    warnings = []
    shortfall = req.num_questions - len(selected)
    generated = []
    if shortfall:
        try:
            generated = await generate_questions(
                req.course,
                req.topics or known_topics,
                shortfall,
                avoid=[r["question_text"] for r in bank],
            )
        except Exception as e:
            traceback.print_exc()
            warnings.append(f"Couldn't write {shortfall} new questions: {e}")

    try:
        await answer_questions(req.course, selected)
    except Exception as e:
        traceback.print_exc()
        warnings.append(f"Couldn't write answers for some questions: {e}")

    questions = selected + generated
    if not questions:
        raise HTTPException(status_code=502, detail=warnings[0] if warnings else "No questions available for this course")

    random.shuffle(questions)
    return {
        "course": req.course,
        "requested": req.num_questions,
        "from_bank": len(selected),
        "generated": len(generated),
        "warnings": warnings,
        "questions": [to_exam_question(q) for q in questions],
    }
