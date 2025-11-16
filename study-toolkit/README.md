# Study Toolkit

This project is a comprehensive study toolkit that integrates an Electron frontend with a FastAPI backend. It provides various features to assist users in managing their study materials effectively.

## Features

- **Syllabus Processing**: Extract course names and topics from syllabi.
- **Keyword Extraction**: Identify important keywords from the syllabus for better searchability.
- **Web Searching**: Utilize SerpAPI to perform web searches based on extracted keywords.
- **PDF Downloading**: Download PDFs from the web using Playwright.
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

2. **Set up .env.local**
3. **Set up the FastAPI backend**:
   - Navigate to the `fastapi-backend` directory.
   - Install the required dependencies:
     ```
     pip install -r requirements.txt
     ```
   - Run the FastAPI server:
     ```
     uvicorn app.main:app --reload
     ```

4. **Set up the Electron app**:
   - Navigate to the `electron-app` directory.
   - Install the required dependencies:
     ```
     npm install
     ```
   - Start the Electron application:
     ```
     npm start
     ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
