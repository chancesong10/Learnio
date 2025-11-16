"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestions = exports.insertQuestion = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataFolder = path_1.default.join(__dirname, "../../data");
if (!fs_1.default.existsSync(dataFolder)) {
    fs_1.default.mkdirSync(dataFolder, { recursive: true });
}
const dbPath = path_1.default.join(dataFolder, "question_bank.sqlite");
const db = new better_sqlite3_1.default(dbPath);
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
function insertQuestion(q) {
    const stmt = db.prepare(`
        INSERT INTO questions
        (question_text, course, topics, difficulty, source_pdf)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(q.question_text, q.course || "", q.topics || "", q.difficulty || "", q.source_pdf || "");
}
exports.insertQuestion = insertQuestion;
function getQuestions(filter) {
    let query = "SELECT * FROM questions WHERE 1=1";
    const params = [];
    if (filter === null || filter === void 0 ? void 0 : filter.course) {
        query += " AND course=?";
        params.push(filter.course);
    }
    if (filter === null || filter === void 0 ? void 0 : filter.difficulty) {
        query += " AND difficulty=?";
        params.push(filter.difficulty);
    }
    if (filter === null || filter === void 0 ? void 0 : filter.type) {
        query += " AND type=?";
        params.push(filter.type);
    }
    return db.prepare(query).all(...params);
}
exports.getQuestions = getQuestions;
exports.default = db;
