import { insertQuestion, getQuestions } from "./db.js";

console.log("Testing SQLite Database");

insertQuestion({
    question_text: "What is 2 + 2?",
    course: "Math 101",
    topics: "addition, basics",
    difficulty: "easy",
    source_pdf: "math_basics.pdf"
});

insertQuestion({
    question_text: "Define Newton's Second Law.",
    course: "Physics 101",
    topics: "laws of motion",
    difficulty: "medium",
    source_pdf: "physics_laws.pdf"
});

insertQuestion({
    question_text: "What is Charles' social security number?",
    course: "cybersecurity 101",
    topics: "hacking",
    difficulty: "easy",
    source_pdf: "charles.pdf"
});

const allQuestions = getQuestions();
console.log("\nAll questions in database:");
console.log(allQuestions);

const easyMath = getQuestions({ course: "Math 101", difficulty: "easy" });
console.log("\nFiltered questions (Math 101, easy):");
console.log(easyMath);
