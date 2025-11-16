import sys
import json
import PyPDF2
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncio
from google import genai
from google.genai import types
from fastapi import APIRouter

router = APIRouter()

# Load .env from the project root
env_path = Path(__file__).parent.parent.parent.parent / '.env.local'
load_dotenv(env_path)

# Initialize Gemini API client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Extract text from a PDF file
def extract_text_from_pdf(pdf_path: str) -> str:
    with open(pdf_path, "rb") as f:
        pdf_reader = PyPDF2.PdfReader(f)
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()

# Pydantic model for structured JSON output
from pydantic import BaseModel
from typing import List

class SyllabusAnalysis(BaseModel):
    course_name: str
    topics: List[str]

# Async function to analyze syllabus using Gemini
async def analyze_syllabus_with_gemini(text: str) -> dict:
    prompt = f"""
Analyze the following course syllabus and extract:
1. Course name
2. Topics that will be quizzed on (List where each entry is concise and no more than 3 words)

Format your response as JSON with keys:
- course_name (string)
- topics (array of strings)

Syllabus Summary:
{text}
"""
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    # Parse JSON output
    try:
        analysis = json.loads(response.text)
    except Exception as e:
        print("Raw Gemini output:", response)
        print(f"Exception occurred: {type(e).__name__} - {e}")
        analysis = {"course_name": "Unknown Course", "topics": []}

    return analysis

# Main function
async def main():
    if len(sys.argv) < 2:
        print("Usage: python syllabus_processing.py <path_to_pdf>")
        sys.exit(1)

    syllabus_file = sys.argv[1]
    text = extract_text_from_pdf(syllabus_file)
    analysis = await analyze_syllabus_with_gemini(text)
    output = {"raw_text": text, **analysis}
    print(json.dumps(output, indent=4))

if __name__ == "__main__":
    asyncio.run(main())
