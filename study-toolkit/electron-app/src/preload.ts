import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    // Example API methods
    fetchSyllabus: (syllabusData) => ipcRenderer.invoke('fetch-syllabus', syllabusData),
    extractKeywords: (text) => ipcRenderer.invoke('extract-keywords', text),
    searchWeb: (query) => ipcRenderer.invoke('search-web', query),
    downloadPDF: (url) => ipcRenderer.invoke('download-pdf', url),
    generateFlashcards: (notes) => ipcRenderer.invoke('generate-flashcards', notes),
    createPracticeExam: (materials) => ipcRenderer.invoke('create-practice-exam', materials),
});