const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Example API methods with proper typing
    fetchSyllabus: (syllabusData: any) => ipcRenderer.invoke('fetch-syllabus', syllabusData),
    extractKeywords: (text: string) => ipcRenderer.invoke('extract-keywords', text),
    searchWeb: (query: string) => ipcRenderer.invoke('search-web', query),
    downloadPDF: (url: string) => ipcRenderer.invoke('download-pdf', url),
    generateFlashcards: (notes: any) => ipcRenderer.invoke('generate-flashcards', notes),
    createPracticeExam: (materials: any) => ipcRenderer.invoke('create-practice-exam', materials),
});