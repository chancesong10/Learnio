"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestions = exports.getQuestions = exports.insertQuestion = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataFolder = path_1.default.join(__dirname, "../../data");
if (!fs_1.default.existsSync(dataFolder)) {
    fs_1.default.mkdirSync(dataFolder, { recursive: true });
}
const dbPath = path_1.default.join(dataFolder, "question_bank.sqlite");
const db = new better_sqlite3_1.default(dbPath);
db.prepare(`
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT NOT NULL,
        course TEXT,
        topics TEXT,
        difficulty TEXT,
        source_pdf TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_text, course)
    )
    `).run();
// function rebuildQuestionsTable() {
//     const tableExists = db
//         .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'")
//         .get();
//     if (tableExists) { //if the table exists, rename it so it could be deleted
//         db.prepare(`ALTER TABLE questions RENAME TO old_questions`).run();
//     }
//     // Create new table with UNIQUE constraint
//     db.prepare(`
//     CREATE TABLE IF NOT EXISTS questions (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         question_text TEXT NOT NULL,
//         course TEXT,
//         topics TEXT,
//         difficulty TEXT,
//         source_pdf TEXT,
//         timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
//         UNIQUE(question_text, course)
//     )
//     `).run();
//     if (tableExists) {
//         // Copy distinct rows into new table to remove duplicates
//         db.prepare(`
//         INSERT OR IGNORE INTO questions (question_text, course, topics, difficulty, source_pdf, timestamp)
//         SELECT DISTINCT question_text, course, topics, difficulty, source_pdf, timestamp
//         FROM old_questions
//         `).run();
//         // delete
//         db.prepare(`DROP TABLE old_questions`).run();
//     }
// }
// // Rebuild table on startup
// rebuildQuestionsTable();
function insertQuestion(q) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO questions
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
    if (filter === null || filter === void 0 ? void 0 : filter.topics) {
        query += " AND topics LIKE ?";
        params.push(`%${filter.topics}%`);
    }
    return db.prepare(query).all(...params);
}
exports.getQuestions = getQuestions;
function deleteQuestions(ids) {
    if (ids.length === 0)
        return;
    const placeholders = ids.map(() => "?").join(", ");
    const stmt = db.prepare(`DELETE FROM questions WHERE id IN (${placeholders})`);
    stmt.run(...ids);
}
exports.deleteQuestions = deleteQuestions;
exports.default = db;
