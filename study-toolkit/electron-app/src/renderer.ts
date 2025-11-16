// This file handles the user interface logic for the Electron app. 

declare global {
    interface Window {
        api: {
            processSyllabus: (fileBuffer: ArrayBuffer) => Promise<any>;
            extractKeywords: (text: string) => Promise<any>;
            searchWeb: (query: string) => Promise<any>;
            downloadPDF: (url: string) => Promise<any>;
            generateFlashcards: (notes: any) => Promise<any>;
            createPracticeExam: (materials: any) => Promise<any>;
            getCourses: () => Promise<any>;
            getTopics: (course: string) => Promise<any>;
        };
    }
}

export {};

const syllabusUpload = document.getElementById('syllabus-upload') as HTMLInputElement;
const summarizeBtn = document.getElementById('summarize-syllabus');
const summaryOutput = document.getElementById('syllabus-summary');
const practiceExamSection = document.getElementById('practice-exam-section');
const courseSelect = document.getElementById('course-select') as HTMLSelectElement;
const topicsChecklist = document.getElementById('topics-checklist');
const createPracticeExamBtn = document.getElementById('create-practice-exam');
const outputDiv = document.getElementById('output');

console.log('Renderer script loaded');

// ==================== FORMATTING HELPERS ====================

function formatSuccessMessage(title: string, message: string): string {
    return `
<div class="bg-green-900/30 border-l-4 border-green-500 p-4 rounded-lg">
    <div class="flex items-start">
        <svg class="w-6 h-6 text-green-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
            <h3 class="text-green-300 font-semibold text-lg">${title}</h3>
            <p class="text-green-400 mt-1">${message}</p>
        </div>
    </div>
</div>`;
}

function formatErrorMessage(title: string, message: string): string {
    return `
<div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
    <div class="flex items-start">
        <svg class="w-6 h-6 text-red-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
            <h3 class="text-red-800 font-semibold text-lg">${title}</h3>
            <p class="text-red-700 mt-1">${message}</p>
        </div>
    </div>
</div>`;
}

function formatLoadingMessage(message: string): string {
    return `
<div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
    <div class="flex items-start">
        <svg class="animate-spin w-6 h-6 text-blue-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div>
            <p class="text-blue-700 font-medium">${message}</p>
        </div>
    </div>
</div>`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPracticeExam(exam: any[]): string {
    if (!exam || exam.length === 0) {
        return '<p class="text-gray-500 text-center py-8">No questions found.</p>';
    }

    let html = '<div class="space-y-4">';
    
    exam.forEach((question, index) => {
        const questionText = question.question_text || question.question || 'No question text';
        const topics = question.topics || '';
        const difficulty = question.difficulty || '';
        
        html += `
        <div class="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md">
                    ${index + 1}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-gray-800 font-medium leading-relaxed mb-3">${escapeHtml(questionText)}</p>
                    <div class="flex flex-wrap gap-2">
                        ${topics ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                            📚 ${escapeHtml(topics)}
                        </span>` : ''}
                        ${difficulty ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            difficulty.toLowerCase() === 'easy' ? 'bg-green-100 text-green-800 border border-green-200' :
                            difficulty.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-red-100 text-red-800 border border-red-200'
                        }">
                            ${difficulty.toLowerCase() === 'easy' ? '⭐' : difficulty.toLowerCase() === 'medium' ? '⭐⭐' : '⭐⭐⭐'} ${escapeHtml(difficulty.charAt(0).toUpperCase() + difficulty.slice(1))}
                        </span>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    html += '</div>';
    return html;
}

// ==================== EVENT HANDLERS ====================

// Load courses on page load
window.addEventListener('DOMContentLoaded', async () => {
    await updateCourseDropdown();
});

// File upload listener
if (syllabusUpload) {
    syllabusUpload.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        if (target && target.files) {
            const file = target.files[0];
            if (file) {
                console.log('File uploaded:', file.name);
            }
        }
    });
}

// Summarize syllabus
if (summarizeBtn) {
    console.log('Attaching click listener to summarize button');
    summarizeBtn.addEventListener('click', async () => {
        console.log('Summarize button clicked!');
        
        if (!syllabusUpload || !syllabusUpload.files?.length) {
            console.log('No file uploaded');
            if (summaryOutput) summaryOutput.innerText = '⚠️  Please upload a syllabus first.';
            return;
        }

        const file = syllabusUpload.files[0];
        console.log('File selected:', file.name, 'Size:', file.size);

        if (summaryOutput) {
            summaryOutput.innerText = '⏳ Processing syllabus and generating questions... This may take a few minutes.';
        }

        try {
            const fileBuffer = await file.arrayBuffer();
            console.log('File read, size:', fileBuffer.byteLength);
            
            console.log('Calling window.api.processSyllabus');
            const result = await window.api.processSyllabus(fileBuffer);
            console.log('Got result:', result);
            
            // Display the summary
            const resultText = JSON.stringify(result, null, 2);
            if (summaryOutput) summaryOutput.innerText = resultText;
            
            // Refresh the courses dropdown to include the new course
            if (result.status === 'success') {
                await updateCourseDropdown();
                
                // Show the practice exam section
                if (practiceExamSection) {
                    practiceExamSection.style.display = 'block';
                }
                
                // If the pipeline returned a course_name, auto-select it
                if (result.data?.course_name && courseSelect) {
                    setTimeout(async () => {
                        const courseName = result.data.course_name;
                        courseSelect.value = courseName;
                        await updateTopicsChecklist(courseName);
                        
                        if (summaryOutput) {
                            const currentText = summaryOutput.innerText;
                            summaryOutput.innerText = `${currentText}\n\n✅ Auto-selected course: "${courseName}"`;
                        }
                    }, 500);
                }
            }
            
        } catch (err) {
            console.error('Error caught:', err);
            const errorText = '❌ Error:\n' + (err instanceof Error ? err.message : String(err));
            if (summaryOutput) summaryOutput.innerText = errorText;
        }
    });
}

// Update course dropdown - fetch from database
async function updateCourseDropdown() {
    if (!courseSelect) return;
    
    try {
        // Clear existing options except the first one
        while (courseSelect.options.length > 1) {
            courseSelect.remove(1);
        }
        
        // Fetch courses from database
        const result = await window.api.getCourses();
        
        if (result.status === 'success' && result.courses) {
            result.courses.forEach((course: string) => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                courseSelect.appendChild(option);
            });
            
            // Show practice exam section if courses are available
            if (result.courses.length > 0 && practiceExamSection) {
                practiceExamSection.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Error fetching courses:', err);
    }
}

// Course selection change handler - fetch topics from database
if (courseSelect) {
    courseSelect.addEventListener('change', async () => {
        const selectedCourse = courseSelect.value;
        await updateTopicsChecklist(selectedCourse);
    });
}

// Update topics checklist - fetch from database
async function updateTopicsChecklist(course: string) {
    if (!topicsChecklist) return;
    
    topicsChecklist.innerHTML = '';
    
    if (!course) {
        topicsChecklist.innerHTML = '<p class="text-gray-500 text-sm">Select a course to see available topics</p>';
        return;
    }
    
    try {
        topicsChecklist.innerHTML = '<p class="text-gray-500 text-sm">Loading topics...</p>';
        
        const result = await window.api.getTopics(course);
        
        topicsChecklist.innerHTML = '';
        
        if (!result.status || result.status === 'error' || !result.topics || result.topics.length === 0) {
            topicsChecklist.innerHTML = '<p class="text-gray-500 text-sm">No topics found for this course</p>';
            return;
        }
        
        // Create checkboxes for each topic
        result.topics.forEach((topic: string, index: number) => {
            const div = document.createElement('div');
            div.className = 'flex items-center mb-2';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `topic-${index}`;
            checkbox.value = topic;
            checkbox.className = 'mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
            
            const label = document.createElement('label');
            label.htmlFor = `topic-${index}`;
            label.textContent = topic;
            label.className = 'text-sm text-gray-700 cursor-pointer';
            
            div.appendChild(checkbox);
            div.appendChild(label);
            topicsChecklist.appendChild(div);
        });
    } catch (err) {
        console.error('Error fetching topics:', err);
        topicsChecklist.innerHTML = '<p class="text-red-500 text-sm">Error loading topics</p>';
    }
}

// Create practice exam - WITH BEAUTIFUL FORMATTING
if (createPracticeExamBtn) {
    createPracticeExamBtn.addEventListener('click', async () => {
        if (!courseSelect || !courseSelect.value) {
            if (outputDiv) outputDiv.innerHTML = formatErrorMessage('No Course Selected', 'Please select a course first.');
            return;
        }
        
        const selectedCourse = courseSelect.value;
        const numQuestionsInput = document.getElementById('num-questions') as HTMLInputElement;
        const numQuestions = numQuestionsInput ? parseInt(numQuestionsInput.value) : 20;
        
        // Get selected topics
        const selectedTopics: string[] = [];
        if (topicsChecklist) {
            const checkboxes = topicsChecklist.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(checkbox => {
                selectedTopics.push((checkbox as HTMLInputElement).value);
            });
        }
        
        if (outputDiv) {
            outputDiv.innerHTML = formatLoadingMessage('Creating your practice exam... This may take a moment.');
        }
        
        try {
            const exam = await window.api.createPracticeExam({
                course: selectedCourse,
                topics: selectedTopics.length > 0 ? selectedTopics : undefined,
                num_questions: numQuestions
            });
            
            console.log('Practice exam created:', exam);
            
            if (outputDiv) {
                if (exam.status === 'success' && exam.exam && exam.exam.length > 0) {
                    // Create beautiful header
                    let headerHtml = `
                    <div class="mb-6">
                        ${formatSuccessMessage('Practice Exam Created! 🎉', `Successfully generated ${exam.exam.length} practice questions`)}
                        <div class="mt-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-5 border border-gray-200 shadow-sm">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                                    </svg>
                                    <div>
                                        <span class="text-gray-600 font-medium">Course:</span>
                                        <span class="text-gray-800 ml-2 font-semibold">${escapeHtml(selectedCourse)}</span>
                                    </div>
                                </div>
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <div>
                                        <span class="text-gray-600 font-medium">Questions:</span>
                                        <span class="text-gray-800 ml-2 font-semibold">${exam.exam.length}</span>
                                    </div>
                                </div>
                                ${selectedTopics.length > 0 ? `
                                <div class="col-span-full flex items-start">
                                    <svg class="w-5 h-5 text-purple-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                    </svg>
                                    <div>
                                        <span class="text-gray-600 font-medium">Selected Topics:</span>
                                        <div class="mt-1 flex flex-wrap gap-1">
                                            ${selectedTopics.map(t => `<span class="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">${escapeHtml(t)}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                                ` : `
                                <div class="col-span-full flex items-center">
                                    <svg class="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                                    </svg>
                                    <span class="text-gray-600 font-medium">Topics: <span class="text-gray-800 ml-1">All topics included</span></span>
                                </div>
                                `}
                            </div>
                        </div>
                    </div>`;
                    
                    outputDiv.innerHTML = headerHtml + formatPracticeExam(exam.exam);
                } else if (exam.status === 'error') {
                    outputDiv.innerHTML = formatErrorMessage('Error Creating Exam', exam.message || 'Failed to create practice exam. Please try again.');
                } else {
                    outputDiv.innerHTML = formatErrorMessage('No Questions Found', 'No questions available for this course and topic selection. Try selecting different topics or processing more study materials.');
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (outputDiv) {
                outputDiv.innerHTML = formatErrorMessage('Error Creating Practice Exam', errorMessage);
            }
            console.error('Error:', err);
        }
    });
}