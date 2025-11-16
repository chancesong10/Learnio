import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
const dataFolder = path.join(__dirname, "../../data");
if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}
const dbPath = path.join(dataFolder, "question_bank.sqlite");
const db = new Database(dbPath);
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
export function insertQuestion(q) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO questions
        (question_text, course, topics, difficulty, source_pdf)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(q.question_text, q.course || "", q.topics || "", q.difficulty || "", q.source_pdf || "");
}
export function getQuestions(filter) {
    let query = "SELECT * FROM questions WHERE 1=1";
    const params = [];
    if (filter?.course) {
        query += " AND course=?";
        params.push(filter.course);
    }
    if (filter?.difficulty) {
        query += " AND difficulty=?";
        params.push(filter.difficulty);
    }
    if (filter?.topics) {
        query += " AND topics LIKE ?";
        params.push(`%${filter.topics}%`);
    }
    return db.prepare(query).all(...params);
}
export function deleteQuestions(ids) {
    if (ids.length === 0)
        return;
    const placeholders = ids.map(() => "?").join(", ");
    const stmt = db.prepare(`DELETE FROM questions WHERE id IN (${placeholders})`);
    stmt.run(...ids);
}
export default db;
