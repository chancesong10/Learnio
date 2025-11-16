from fastapi import APIRouter, UploadFile, File
from typing import List
import random

router = APIRouter()

@router.post("/create-practice-exam/")
async def create_practice_exam(files: List[UploadFile] = File(...)):
    # Logic to create practice exams from uploaded materials
    exam_questions = []
    
    for file in files:
        content = await file.read()
        # Process the content to extract questions (placeholder logic)
        questions = extract_questions_from_content(content)
        exam_questions.extend(questions)

    random.shuffle(exam_questions)
    return {"exam_questions": exam_questions}

def extract_questions_from_content(content: bytes) -> List[str]:
    # Placeholder function to simulate question extraction
    return [f"Question {i+1} from content" for i in range(5)]  # Simulating 5 questions per file