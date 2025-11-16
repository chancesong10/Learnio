from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class Flashcard(BaseModel):
    question: str
    answer: str

@router.post("/generate_flashcards", response_model=List[Flashcard])
async def generate_flashcards(notes: List[str]) -> List[Flashcard]:
    flashcards = []
    for note in notes:
        # Simple logic for generating flashcards
        question = note
        answer = "Answer for: " + note  # Placeholder for actual answer generation logic
        flashcards.append(Flashcard(question=question, answer=answer))
    return flashcards