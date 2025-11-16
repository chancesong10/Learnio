from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv('.env.local') # Load environment variables from .env.local
from .api import syllabus_processing, keyword_extraction, web_search, pdf_downloader, flashcard_generator, practice_exam_creator

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Study Toolkit API"}

# Include your API routers here
app.include_router(syllabus_processing.router)
app.include_router(keyword_extraction.router)
app.include_router(web_search.router)
app.include_router(pdf_downloader.router)
app.include_router(flashcard_generator.router)
app.include_router(practice_exam_creator.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)