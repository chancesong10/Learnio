"""Shared question format, storage, and Gemini helpers for answering and writing questions."""
import sqlite3

from .config import get_db_connection
from .llm import generate_json

GENERATED_SOURCE = "generated"
MAX_PER_REQUEST = 20  # keeps each Gemini response small enough to finish reliably

# How questions and answers should be written, shared by every prompt that produces them.
# The app renders these fields as Markdown with KaTeX math.
ANSWER_STYLE = """For each question also give:
- answer: the correct, complete answer (for multiple choice, the correct option and its text)
- explanation: 1-3 sentences on how to get there or why it is right; for calculations,
  show the key steps

Format the question, answer and explanation as Markdown (lists, **bold**, tables where they help).
Write every mathematical expression, variable and unit-bearing formula in LaTeX: inline as
$...$ (for example $v = \\sqrt{2gh}$) and standalone equations as $$...$$ on their own line.
Never use $ for money; write amounts like "USD 5" instead."""

QUESTION_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "question": {"type": "string"},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        "topic": {"type": "string"},
        "answer": {"type": "string"},
        "explanation": {"type": "string"},
    },
    "required": ["question", "difficulty", "topic", "answer", "explanation"],
    "additionalProperties": False,
}

QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": QUESTION_ITEM_SCHEMA}},
    "required": ["questions"],
    "additionalProperties": False,
}

ANSWERS_SCHEMA = {
    "type": "object",
    "properties": {
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                    "explanation": {"type": "string"},
                },
                "required": ["id", "question", "answer", "explanation"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["answers"],
    "additionalProperties": False,
}


def insert_questions(questions: list) -> list:
    """Store questions (dicts in QUESTION_ITEM_SCHEMA shape plus course/source_pdf).

    Returns the stored rows, skipping any the course already had.
    """
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    stored = []
    try:
        for q in questions:
            cur = conn.execute("""
                INSERT OR IGNORE INTO questions
                (question_text, course, topics, difficulty, source_pdf, answer, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                q.get("question") or "",
                q.get("course") or "",
                q.get("topic") or "",
                q.get("difficulty") or "",
                q.get("source_pdf") or "",
                q.get("answer") or "",
                q.get("explanation") or "",
            ))
            if cur.rowcount:
                stored.append(dict(conn.execute("SELECT * FROM questions WHERE id = ?", (cur.lastrowid,)).fetchone()))
        conn.commit()
    finally:
        conn.close()
    print(f"✓ {len(stored)} new questions stored in the question bank")
    return stored


async def answer_questions(course: str, rows: list) -> None:
    """Fill in answer/explanation for question rows that lack them, in place and in the database.

    Also stores Gemini's Markdown/LaTeX version of each question's text."""
    missing = [r for r in rows if not r.get("answer")]
    for start in range(0, len(missing), MAX_PER_REQUEST):
        batch = missing[start:start + MAX_PER_REQUEST]
        listing = "\n\n".join(f"[id {r['id']}] {r['question_text']}" for r in batch)
        prompt = f"""These are practice questions for the course "{course}". Answer every one of them,
using the id shown before each question.

Also return each question as "question", with the same wording but reformatted as described
below (many were extracted from PDFs as plain text, e.g. "x^2y" should become $x^2 y$).

{ANSWER_STYLE}

<questions>
{listing}
</questions>"""
        result = await generate_json([prompt], ANSWERS_SCHEMA)
        by_id = {a["id"]: a for a in result["answers"]}

        conn = get_db_connection()
        try:
            for r in batch:
                a = by_id.get(r["id"])
                if not a:
                    continue
                r["answer"], r["explanation"] = a["answer"], a["explanation"]
                conn.execute("UPDATE questions SET answer = ?, explanation = ? WHERE id = ?",
                             (a["answer"], a["explanation"], r["id"]))
                formatted = a["question"].strip()
                if formatted and formatted != r["question_text"]:
                    try:
                        conn.execute("UPDATE questions SET question_text = ? WHERE id = ?", (formatted, r["id"]))
                        r["question_text"] = formatted
                    except sqlite3.IntegrityError:
                        pass  # the course already has this exact question text
            conn.commit()
        finally:
            conn.close()


async def generate_questions(course: str, topics: list, count: int, avoid: list) -> list:
    """Have Gemini write `count` new questions for the course and store them."""
    generated = []
    while len(generated) < count:
        want = min(MAX_PER_REQUEST, count - len(generated))
        seen = "\n".join(f"- {q}" for q in (avoid + [g["question_text"] for g in generated])[-40:])
        topic_line = ", ".join(topics) if topics else "the core material of the course"
        prompt = f"""Write {want} new exam-style practice questions for the university course "{course}".
Cover these topics: {topic_line}. Tag each question with one of those topics.
Mix difficulties, and make each question self-contained with any values it needs.

{ANSWER_STYLE}

Do not repeat or trivially reword any of these existing questions:
{seen or "- (none yet)"}"""
        result = await generate_json([prompt], QUESTIONS_SCHEMA)
        batch = result["questions"][:want]
        if not batch:
            break
        for q in batch:
            q["course"] = course
            q["source_pdf"] = GENERATED_SOURCE
        stored = insert_questions(batch)
        if not stored:
            break  # everything was a duplicate; stop instead of looping forever
        generated.extend(stored)
    return generated
