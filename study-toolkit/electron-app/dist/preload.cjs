const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // File and API methods
    processSyllabus: (fileBuffer) => ipcRenderer.invoke('process-syllabus', fileBuffer),
    extractKeywords: (text) => ipcRenderer.invoke('extract-keywords', text),
    searchWeb: (query) => ipcRenderer.invoke('search-web', query),
    downloadPDF: (url) => ipcRenderer.invoke('download-pdf', url),
    generateFlashcards: (notes) => ipcRenderer.invoke('generate-flashcards', notes),
    createPracticeExam: (materials) => ipcRenderer.invoke('create-practice-exam', materials),
});
