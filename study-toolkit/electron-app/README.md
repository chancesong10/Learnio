# Study Toolkit Electron Application

The desktop front end for the Study Toolkit. Upload a syllabus to build a question bank for the course, then generate practice exams filtered by topic.

The app talks to the FastAPI backend at `http://127.0.0.1:8000` and reads the question bank from `study-toolkit/data/question_bank.sqlite`, so start the backend first (see the main `study-toolkit/README.md`).

## Running

```
npm install
npm start
```

`npm start` compiles Tailwind CSS and TypeScript into `dist/` and launches Electron. The project uses ES modules (`"type": "module"`); the preload script is CommonJS (`preload.cjs`) because Electron loads preload scripts that way.

## License

This project is licensed under the MIT License.
