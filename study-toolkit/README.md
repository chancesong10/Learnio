# Study Toolkit

This project is a comprehensive study toolkit that integrates an Electron frontend with a FastAPI backend. It provides various features to assist users in managing their study materials effectively.

## Features

- **Syllabus Processing**: Extract course names and topics from syllabi with Gemini.
- **Past Exam Search**: Find past exam PDFs for the course with SerpAPI and download them.
- **Question Bank**: Extract practice questions from the downloaded exams into a local SQLite database.
- **Practice Exam Creation**: Build practice exams from the question bank, filtered by topic.
- **Keyword Extraction** and **Flashcard Generation** API endpoints.

## Project Structure

```
study-toolkit
├── .env.example            # copy to .env.local and add your API keys
├── data/                   # question_bank.sqlite (created on first run)
├── downloaded_exams/       # past exam PDFs, one folder per course
├── electron-app
│   ├── src
│   │   ├── main.ts         # Electron main process, talks to the backend and the database
│   │   ├── preload.cjs     # exposes window.api to the renderer
│   │   ├── renderer.ts     # UI logic
│   │   ├── renderer.html
│   │   └── assets/styles.css
│   ├── package.json
│   └── tsconfig.json
└── fastapi-backend
    ├── app
    │   ├── main.py         # FastAPI app and the syllabus pipeline endpoint
    │   ├── config.py       # paths, environment variables, database setup
    │   ├── llm.py          # Gemini client and structured JSON helper
    │   └── api
    │       ├── syllabus_processing.py
    │       ├── keyword_extraction.py
    │       ├── web_search.py
    │       ├── pdf_downloader.py
    │       ├── flashcard_generator.py
    │       └── practice_exam_creator.py
    └── requirements.txt
```

## Getting Started

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd study-toolkit
   ```

2. **Set up `.env.local`**: copy `study-toolkit/.env.example` to `study-toolkit/.env.local` and add your `GEMINI_API_KEY` and `SERPAPI_API_KEY`.

3. **Set up and start the FastAPI backend** (the Electron app needs it running):
   ```
   cd fastapi-backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
   The API runs at `http://127.0.0.1:8000` (docs at `/docs`).

4. **Set up and start the Electron app** in a second terminal:
   ```
   cd electron-app
   npm install
   npm start
   ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
