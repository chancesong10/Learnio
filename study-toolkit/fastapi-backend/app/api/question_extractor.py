from fastapi import APIRouter, HTTPException, Query
import requests
from io import BytesIO
import PyPDF2
from google import genai
from google.genai import types
import os
import json
from dotenv import load_dotenv
from pathlib import Path
from typing import List
from pydantic import BaseModel
import urllib3

# Disable SSL warnings (optional, for cleaner logs)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

router = APIRouter()

# Load .env from the project root
env_path = Path(__file__).parent.parent.parent.parent / '.env.local'
load_dotenv(env_path)

# Initialize Gemini API client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Pydantic models for structured output
class Question(BaseModel):
    question_text: str
    course_name: str

class QuestionList(BaseModel):
    course_name: str
    questions: List[str]

@router.post("/extract-pdf-text/")
async def extract_pdf_text(url: str = Query(...)):
    """Download PDF from URL, extract text, identify course and split into questions"""
    try:
        print(f"Downloading PDF from: {url}")
        
        # Download PDF content into memory with SSL verification disabled
        response = requests.get(url, timeout=30, verify=False)
        response.raise_for_status()
        
        # Create a BytesIO object (file-like object in memory)
        pdf_file = BytesIO(response.content)
        
        # Extract text using PyPDF2
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        print(f"✓ Extracted {len(text)} characters from {len(pdf_reader.pages)} pages")
        
        # Use Gemini to extract course name and split into questions
        prompt = f"""
Analyze the following document and extract:
1. The course name (look at the top of the document, course code, title, etc.)
2. Split the document into individual questions. Each question should be extracted as a separate string.

Format your response as JSON with keys:
- course_name (string): The name or code of the course
- questions (array of strings): Each element is one complete question

Document text:
{text}
"""
        
        gemini_response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        # Parse JSON output
        try:
            analysis = json.loads(gemini_response.text)
            course_name = analysis.get("course_name", "Unknown Course")
            questions = analysis.get("questions", [])
            
            # Format output as list of questions with course name
            formatted_questions = [
                {
                    "course_name": course_name,
                    "question_text": q
                }
                for q in questions
            ]
            
            print(f"✓ Extracted {len(formatted_questions)} questions for course: {course_name}")
            
            return {
                "message": "Questions extracted successfully",
                "course_name": course_name,
                "num_questions": len(formatted_questions),
                "questions": formatted_questions  # This will be passed to keyword_extractor.py
            }
            
        except json.JSONDecodeError as e:
            print("Raw Gemini output:", gemini_response.text)
            print(f"JSON parsing error: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse Gemini response")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")