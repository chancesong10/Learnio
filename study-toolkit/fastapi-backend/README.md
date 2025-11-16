# FastAPI Backend for Study Toolkit

This directory contains the FastAPI backend for the Study Toolkit application. The backend provides various functionalities to support the study toolkit features, including syllabus processing, keyword extraction, web searching, PDF downloading, flashcard generation, and practice exam creation.

## Features

- **Syllabus Processing**: Extract course names and topics from syllabi.
- **Keyword Extraction**: Identify important keywords from the syllabus for further processing.
- **Web Searching**: Utilize SerpAPI to perform web searches based on extracted keywords.
- **PDF Downloading**: Download PDFs from the web using Playwright.
- **Flashcard Generation**: Create flashcards from notes and summaries for effective studying.
- **Practice Exam Creation**: Generate practice exams from uploaded materials.

## Installation

To install the required dependencies, run:

```
pip install -r requirements.txt
```

## Running the Application

To start the FastAPI server, execute:

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