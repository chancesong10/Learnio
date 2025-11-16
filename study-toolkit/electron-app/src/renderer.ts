// This file handles the user interface logic for the Electron app. 
// It manages user interactions and communicates with the FastAPI backend.

import { ipcRenderer } from 'electron';

document.getElementById('syllabus-upload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);

        ipcRenderer.send('upload-syllabus', formData);
    }
});

ipcRenderer.on('syllabus-processed', (event, data) => {
    // Handle the processed syllabus data
    console.log('Syllabus processed:', data);
    // Update the UI with the processed data
});

document.getElementById('generate-flashcards').addEventListener('click', () => {
    ipcRenderer.send('generate-flashcards');
});

ipcRenderer.on('flashcards-generated', (event, flashcards) => {
    // Handle the generated flashcards
    console.log('Flashcards generated:', flashcards);
    // Update the UI with the flashcards
});

document.getElementById('create-practice-exam').addEventListener('click', () => {
    ipcRenderer.send('create-practice-exam');
});

ipcRenderer.on('practice-exam-created', (event, exam) => {
    // Handle the created practice exam
    console.log('Practice exam created:', exam);
    // Update the UI with the exam
});