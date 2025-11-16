"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // Example API methods with proper typing
    fetchSyllabus: (syllabusData) => electron_1.ipcRenderer.invoke('fetch-syllabus', syllabusData),
    extractKeywords: (text) => electron_1.ipcRenderer.invoke('extract-keywords', text),
    searchWeb: (query) => electron_1.ipcRenderer.invoke('search-web', query),
    downloadPDF: (url) => electron_1.ipcRenderer.invoke('download-pdf', url),
    generateFlashcards: (notes) => electron_1.ipcRenderer.invoke('generate-flashcards', notes),
    createPracticeExam: (materials) => electron_1.ipcRenderer.invoke('create-practice-exam', materials),
});
