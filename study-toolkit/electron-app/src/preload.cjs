const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // File and API methods
    processSyllabus: (fileBuffer, fileName) => ipcRenderer.invoke('process-syllabus', fileBuffer, fileName),
    extractKeywords: (text) => ipcRenderer.invoke('extract-keywords', text),
    searchWeb: (courseName) => ipcRenderer.invoke('search-web', courseName),
    generateFlashcards: (notes) => ipcRenderer.invoke('generate-flashcards', notes),
    createPracticeExam: (materials) => ipcRenderer.invoke('create-practice-exam', materials),

    backendStatus: () => ipcRenderer.invoke('backend-status'),

    // Database query methods
    getCourses: () => ipcRenderer.invoke('get-courses'),
    getTopics: (course) => ipcRenderer.invoke('get-topics', course),
});
