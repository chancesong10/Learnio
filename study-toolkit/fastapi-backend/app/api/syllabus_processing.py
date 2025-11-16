from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re

router = APIRouter()

class Syllabus(BaseModel):
    content: str

@router.post("/process-syllabus/")
async def process_syllabus(syllabus: Syllabus):
    try:
        course_name = extract_course_name(syllabus.content)
        topics = extract_topics(syllabus.content)
        return {"course_name": course_name, "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def extract_course_name(content: str) -> str:
    match = re.search(r'Course Name:\s*(.*)', content)
    return match.group(1).strip() if match else "Unknown Course"

def extract_topics(content: str) -> list:
    topics = re.findall(r'Topic:\s*(.*)', content)
    return [topic.strip() for topic in topics] if topics else []