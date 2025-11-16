import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataFolder = path.join(__dirname, "../../data");
if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "question_bank.sqlite");


const db = new Database(dbPath);

// Questions table
db.prepare(`
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_text TEXT NOT NULL,
    course TEXT,
    topics TEXT,
    difficulty TEXT,
    source_pdf TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// db.prepare(`
// CREATE TABLE IF NOT EXISTS exams (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     course TEXT,
//     year INTEGER,
//     term TEXT,
//     source_pdf TEXT,
//     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `).run();

// db.prepare(`
// CREATE TABLE IF NOT EXISTS flashcards (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     front TEXT NOT NULL,
//     back TEXT NOT NULL,
//     course TEXT,
//     topic TEXT
// )
// `).run();

export function insertQuestion(q: {
    question_text: string,
    course?: string,
    topics?: string,
    difficulty?: string,
    source_pdf?: string
}) {
    const stmt = db.prepare(`
        INSERT INTO questions
        (question_text, course, topics, difficulty, source_pdf)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
        q.question_text,
        q.course || "",
        q.topics || "",
        q.difficulty || "",
        q.source_pdf || ""
    );
}

export function getQuestions(filter?: { //filter is optional
    course?: string,
    difficulty?: string,
    type?: string
}) {
    let query = "SELECT * FROM questions WHERE 1=1";
    const params: string[] = [];
    if (filter?.course) { query += " AND course=?"; params.push(filter.course); }
    if (filter?.difficulty) { query += " AND difficulty=?"; params.push(filter.difficulty); }
    if (filter?.type) { query += " AND type=?"; params.push(filter.type); }
    return db.prepare(query).all(...params);
}

export default db;
