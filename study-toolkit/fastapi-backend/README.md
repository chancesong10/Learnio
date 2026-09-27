# FastAPI Backend for Study Toolkit

This directory contains the FastAPI backend for the Study Toolkit application. The backend provides various functionalities to support the study toolkit features, including syllabus processing, keyword extraction, web searching, PDF downloading, flashcard generation, and practice exam creation.

## Features

- **Syllabus Pipeline** (`POST /api/process-syllabus-pipeline/`): analyze a syllabus (PDF or text) with Gemini, search for past exam PDFs with SerpAPI, download them, and store extracted questions in the question bank.
- **Practice Exam Creation** (`POST /create-practice-exam/`): pick random questions for a course, optionally filtered by topic.
- **Web Searching** (`GET /search`): find past exam and notes PDFs for a course.
- **Keyword Extraction** (`POST /extract_keywords/`): TF-IDF keywords from text.
- **Flashcard Generation** (`POST /generate_flashcards`): question/answer flashcards from notes with Gemini.

## Configuration

The backend reads `study-toolkit/.env.local` (see `study-toolkit/.env.example`):

- `GEMINI_API_KEY` (required; free key from https://aistudio.google.com/apikey)
- `SERPAPI_API_KEY` (required for search and the pipeline)
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

## Installation

To install the required dependencies, run:

```
pip install -r requirements.txt
```

## Running the Application

From the `fastapi-backend` directory, start the FastAPI server with:

```
uvicorn app.main:app --reload
```

The server will be available at `http://127.0.0.1:8000`.

## API Documentation

The API documentation can be accessed at `http://127.0.0.1:8000/docs` after starting the server.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.