# Study Toolkit Electron Application

This repository contains an Electron application that serves as a study toolkit, integrating with a FastAPI backend. The application provides various features to assist users in managing their study materials effectively.

## Features

- **Syllabus Processing**: Extract course names and topics from syllabi.
- **Keyword Extraction**: Identify important keywords from the syllabus for focused study.
- **Web Searching**: Utilize SerpAPI to perform web searches based on extracted keywords.
- **PDF Downloading**: Download relevant PDFs using Playwright.
- **Flashcard Generation**: Create flashcards from notes and summaries for efficient revision.
- **Practice Exam Creation**: Generate practice exams from uploaded materials.

## Project Structure

```
study-toolkit
├── electron-app
│   ├── src
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── renderer.ts
│   │   └── assets
│   │       └── styles.css
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── fastapi-backend
│   ├── app
│   │   ├── main.py
│   │   ├── api
│   │   │   ├── __init__.py
│   │   │   ├── syllabus_processing.py
│   │   │   ├── keyword_extraction.py
│   │   │   ├── web_search.py
│   │   │   ├── pdf_downloader.py
│   │   │   ├── flashcard_generator.py
│   │   │   └── practice_exam_creator.py
│   │   ├── models
│   │   │   └── __init__.py
│   │   ├── services
│   │   │   └── __init__.py
│   │   └── utils
│   │       └── __init__.py
│   ├── requirements.txt
│   └── README.md
└── README.md
```

## Getting Started

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd study-toolkit
   ```

2. **Install dependencies**:
   - For the Electron app:
     ```
     cd electron-app
     npm install
     ```

   - For the FastAPI backend:
     ```
     cd fastapi-backend
     pip install -r requirements.txt
     ```

3. **Run the FastAPI backend**:
   ```
   cd fastapi-backend/app
   uvicorn main:app --reload
   ```

4. **Run the Electron application**:
   ```
   cd electron-app
   npm start

Notes:
- The `start` script now runs `tsc` first and then launches Electron so the app runs the compiled JavaScript from `dist/` instead of trying to run TypeScript directly. This avoids Node/Electron warnings about module type and avoids a performance penalty from reparsing the TypeScript source.
- Alternative: If you prefer using native ECMAScript modules (ESM) instead of CommonJS, add `"type": "module"` to `package.json` and change `tsconfig.json` `module` to `esnext` / `es2020` and adjust any Node-only global usage (like `__dirname`). This requires migrating to ESM semantics and may need updates in imports/exports.
   ```

## License

This project is licensed under the MIT License. See the LICENSE file for details.