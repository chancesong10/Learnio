"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_js_1 = require("./db.js");
// node dist/test_db.js run this to test
console.log("Testing SQLite Database");
(0, db_js_1.insertQuestion)({
    question_text: "What is 2 + 2?",
    course: "Math 101",
    topics: "addition, basics",
    difficulty: "easy",
    source_pdf: "math_basics.pdf"
});
(0, db_js_1.insertQuestion)({
    question_text: "Define Newton's Second Law.",
    course: "Physics 101",
    topics: "laws of motion",
    difficulty: "medium",
    source_pdf: "physics_laws.pdf"
});
(0, db_js_1.insertQuestion)({
    question_text: "What is Charles' social security number?",
    course: "cybersecurity 101",
    topics: "hacking",
    difficulty: "easy",
    source_pdf: "charles.pdf"
});
(0, db_js_1.insertQuestion)({
    question_text: "What is 2 * 2?",
    course: "Math 101",
    topics: "multiplication, basics",
    difficulty: "hard",
    source_pdf: "math_basics.pdf"
});
const allQuestions = (0, db_js_1.getQuestions)();
console.log("\nAll questions in database:");
console.log(allQuestions);
const easyMath = (0, db_js_1.getQuestions)({ course: "Math 101", difficulty: "easy" });
const Math = (0, db_js_1.getQuestions)({ course: "Math 101", topics: "basics" });
const easybasicMath = (0, db_js_1.getQuestions)({ course: "Math 101", difficulty: "easy", topics: "basics" });
console.log("\nFiltered questions (Math 101, easy):");
console.log(easyMath);
console.log("\nFiltered questions (Math 101, basic):"); //should be 2
console.log(Math);
console.log("\nFiltered questions (Math 101, easy, basic):");
console.log(easybasicMath);
// onst stmt = db.prepare(`DELETE FROM questions WHERE id IN (?, ?, ?)`);
// stmt.run(1, 2, 3);c
