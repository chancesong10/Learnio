"use strict";
// This file handles the user interface logic for the Electron app. 
// It manages user interactions and communicates with the FastAPI backend.
Object.defineProperty(exports, "__esModule", { value: true });
const syllabusUpload = document.getElementById('syllabus-upload');
if (syllabusUpload) {
    syllabusUpload.addEventListener('change', (event) => {
        const target = event.target;
        if (target && target.files) {
            const file = target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                // Use the exposed api instead of ipcRenderer
                window.api.fetchSyllabus(formData).then((data) => {
                    console.log('Syllabus processed:', data);
                    // Update the UI with the processed data
                }).catch((err) => {
                    console.error('Error processing syllabus:', err);
                });
            }
        }
    });
}
const generateFlashcardsBtn = document.getElementById('generate-flashcards');
if (generateFlashcardsBtn) {
    generateFlashcardsBtn.addEventListener('click', () => {
        window.api.generateFlashcards({}).then((flashcards) => {
            console.log('Flashcards generated:', flashcards);
            // Update the UI with the flashcards
        }).catch((err) => {
            console.error('Error generating flashcards:', err);
        });
    });
}
const createPracticeExamBtn = document.getElementById('create-practice-exam');
if (createPracticeExamBtn) {
    createPracticeExamBtn.addEventListener('click', () => {
        window.api.createPracticeExam({}).then((exam) => {
            console.log('Practice exam created:', exam);
            // Update the UI with the exam
        }).catch((err) => {
            console.error('Error creating practice exam:', err);
        });
    });
}
