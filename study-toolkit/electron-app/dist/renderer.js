// This file handles the user interface logic for the Electron app. 
// It manages user interactions and communicates with the FastAPI backend.
const syllabusUpload = document.getElementById('syllabus-upload');
if (syllabusUpload) {
    syllabusUpload.addEventListener('change', (event) => {
        const target = event.target;
        if (target && target.files) {
            const file = target.files[0];
            if (file) {
                console.log('File uploaded:', file.name);
            }
        }
    });
}
const generateFlashcardsBtn = document.getElementById('generate-flashcards');
if (generateFlashcardsBtn) {
    generateFlashcardsBtn.addEventListener('click', async () => {
        const output = document.getElementById('output');
        if (output)
            output.innerText = '⏳ Generating flashcards...';
        try {
            const flashcards = await window.api.generateFlashcards({});
            console.log('Flashcards generated:', flashcards);
            if (output) {
                output.innerText = JSON.stringify(flashcards, null, 2);
            }
        }
        catch (err) {
            const errorText = '❌ Error generating flashcards:\n' + (err instanceof Error ? err.message : String(err));
            if (output)
                output.innerText = errorText;
            console.error('Error:', err);
        }
    });
}
const createPracticeExamBtn = document.getElementById('create-practice-exam');
if (createPracticeExamBtn) {
    createPracticeExamBtn.addEventListener('click', async () => {
        const output = document.getElementById('output');
        if (output)
            output.innerText = '⏳ Creating practice exam...';
        try {
            const exam = await window.api.createPracticeExam({});
            console.log('Practice exam created:', exam);
            if (output) {
                output.innerText = JSON.stringify(exam, null, 2);
            }
        }
        catch (err) {
            const errorText = '❌ Error creating practice exam:\n' + (err instanceof Error ? err.message : String(err));
            if (output)
                output.innerText = errorText;
            console.error('Error:', err);
        }
    });
}
const summarizeBtn = document.getElementById('summarize-syllabus');
const outputDiv = document.getElementById('output');
const summaryOutput = document.getElementById('syllabus-summary');
console.log('Renderer script loaded');
console.log('Summarize button:', summarizeBtn);
console.log('Output div:', outputDiv);
console.log('Summary output:', summaryOutput);
if (summarizeBtn) {
    console.log('Attaching click listener to summarize button');
    summarizeBtn.addEventListener('click', async () => {
        console.log('Summarize button clicked!');
        if (!syllabusUpload || !syllabusUpload.files?.length) {
            console.log('No file uploaded');
            if (summaryOutput)
                summaryOutput.innerText = '⚠️  Please upload a syllabus first.';
            return;
        }
        const file = syllabusUpload.files[0];
        console.log('File selected:', file.name);
        console.log('File selected:', file.name, 'Size:', file.size);
        if (summaryOutput) {
            summaryOutput.innerText = '⏳ Processing syllabus...';
            console.log('Set loading message');
        }
        try {
            // Read file as ArrayBuffer
            const fileBuffer = await file.arrayBuffer();
            console.log('File read, size:', fileBuffer.byteLength);
            console.log('Calling window.api.processSyllabus');
            const result = await window.api.processSyllabus(fileBuffer);
            console.log('Got result:', result);
            const resultText = JSON.stringify(result, null, 2);
            if (summaryOutput)
                summaryOutput.innerText = resultText;
            console.log('Syllabus summary:', result);
        }
        catch (err) {
            console.error('Error caught:', err);
            const errorText = '❌ Error:\n' + (err instanceof Error ? err.message : String(err));
            if (summaryOutput)
                summaryOutput.innerText = errorText;
            console.error('Error:', err);
        }
    });
}
else {
    console.log('Summarize button not found!');
}
export {};
