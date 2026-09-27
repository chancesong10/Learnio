from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from ..llm import generate_json

router = APIRouter()

class Flashcard(BaseModel):
    question: str
    answer: str

FLASHCARDS_SCHEMA = {
    "type": "object",
    "properties": {
        "flashcards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                },
                "required": ["question", "answer"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["flashcards"],
    "additionalProperties": False,
}

@router.post("/generate_flashcards", response_model=List[Flashcard])
async def generate_flashcards(notes: List[str]) -> List[Flashcard]:
    if not notes:
        return []

    joined_notes = "\n".join(f"- {note}" for note in notes)
    prompt = f"""Turn these study notes into flashcards. Write one or more flashcards per note,
each with a short question and a concise, accurate answer.

<notes>
{joined_notes}
</notes>"""
    try:
        result = await generate_json([prompt], FLASHCARDS_SCHEMA)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {e}")
    return [Flashcard(**card) for card in result["flashcards"]]
