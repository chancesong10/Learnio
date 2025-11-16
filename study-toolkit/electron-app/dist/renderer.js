// This file handles the user interface logic for the Electron app. 
const syllabusUpload = document.getElementById('syllabus-upload');
const summarizeBtn = document.getElementById('summarize-syllabus');
const summaryOutput = document.getElementById('syllabus-summary');
const practiceExamSection = document.getElementById('practice-exam-section');
const courseSelect = document.getElementById('course-select');
const topicsChecklist = document.getElementById('topics-checklist');
const createPracticeExamBtn = document.getElementById('create-practice-exam');
const outputDiv = document.getElementById('output');
console.log('Renderer script loaded');
// Load courses on page load
window.addEventListener('DOMContentLoaded', async () => {
    await updateCourseDropdown();
});
// File upload listener
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
// Summarize syllabus
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
            if (summaryOutput)
                summaryOutput.innerText = resultText;
            // Refresh the courses dropdown to include the new course
            if (result.status === 'success') {
                await updateCourseDropdown();
                // If the pipeline returned a course_name, auto-select it
                if (result.data?.course_name && courseSelect) {
                    // Wait a bit for the dropdown to update
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
        }
        catch (err) {
            console.error('Error caught:', err);
            const errorText = '❌ Error:\n' + (err instanceof Error ? err.message : String(err));
            if (summaryOutput)
                summaryOutput.innerText = errorText;
        }
    });
}
// Update course dropdown - fetch from database
async function updateCourseDropdown() {
    if (!courseSelect)
        return;
    try {
        // Clear existing options except the first one
        while (courseSelect.options.length > 1) {
            courseSelect.remove(1);
        }
        // Fetch courses from database
        const result = await window.api.getCourses();
        if (result.status === 'success' && result.courses) {
            result.courses.forEach((course) => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                courseSelect.appendChild(option);
            });
        }
    }
    catch (err) {
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
async function updateTopicsChecklist(course) {
    if (!topicsChecklist)
        return;
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
        result.topics.forEach((topic, index) => {
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
    }
    catch (err) {
        console.error('Error fetching topics:', err);
        topicsChecklist.innerHTML = '<p class="text-red-500 text-sm">Error loading topics</p>';
    }
}
// Create practice exam
if (createPracticeExamBtn) {
    createPracticeExamBtn.addEventListener('click', async () => {
        if (!courseSelect || !courseSelect.value) {
            if (outputDiv)
                outputDiv.innerText = '⚠️  Please select a course first.';
            return;
        }
        const selectedCourse = courseSelect.value;
        const numQuestionsInput = document.getElementById('num-questions');
        const numQuestions = numQuestionsInput ? parseInt(numQuestionsInput.value) : 20;
        // Get selected topics
        const selectedTopics = [];
        if (topicsChecklist) {
            const checkboxes = topicsChecklist.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(checkbox => {
                selectedTopics.push(checkbox.value);
            });
        }
        if (outputDiv)
            outputDiv.innerText = '⏳ Creating practice exam...';
        try {
            const exam = await window.api.createPracticeExam({
                course: selectedCourse,
                topics: selectedTopics.length > 0 ? selectedTopics : undefined,
                num_questions: numQuestions
            });
            console.log('Practice exam created:', exam);
            if (outputDiv) {
                if (exam.status === 'success' && exam.exam) {
                    // Format the exam output nicely
                    let output = `✅ Practice Exam Created!\n\n`;
                    output += `Course: ${selectedCourse}\n`;
                    output += `Topics: ${selectedTopics.length > 0 ? selectedTopics.join(', ') : 'All topics'}\n`;
                    output += `Number of Questions: ${exam.exam.length}\n\n`;
                    output += JSON.stringify(exam.exam, null, 2);
                    outputDiv.innerText = output;
                }
                else {
                    outputDiv.innerText = JSON.stringify(exam, null, 2);
                }
            }
        }
        catch (err) {
            const errorText = '❌ Error creating practice exam:\n' + (err instanceof Error ? err.message : String(err));
            if (outputDiv)
                outputDiv.innerText = errorText;
            console.error('Error:', err);
        }
    });
}
export {};
