// This file handles the user interface logic for the Electron app.

declare global {
    interface Window {
        api: {
            processSyllabus: (fileBuffer: ArrayBuffer, fileName?: string) => Promise<any>;
            extractKeywords: (text: string) => Promise<any>;
            searchWeb: (courseName: string) => Promise<any>;
            generateFlashcards: (notes: string[]) => Promise<any>;
            createPracticeExam: (materials: any) => Promise<any>;
            backendStatus: () => Promise<{ status: 'ready' | 'error'; message?: string }>;
            getCourses: () => Promise<any>;
            getTopics: (course: string) => Promise<any>;
        };
    }
}

export {};

import { renderRichText } from './rich-text.js';

interface ExamQuestion {
    id: number;
    question: string;
    topic: string;
    difficulty: string;
    answer: string;
    explanation: string;
    source: string;
}

const MAX_QUESTIONS = 50;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const statusPill = $('backend-status');
const syllabusInput = $<HTMLInputElement>('syllabus-upload');
const dropzone = $<HTMLButtonElement>('dropzone');
const analyzeBtn = $<HTMLButtonElement>('summarize-syllabus');
const summary = $('syllabus-summary');
const courseSelect = $<HTMLSelectElement>('course-select');
const topicsBox = $('topics-checklist');
const numInput = $<HTMLInputElement>('num-questions');
const generateBtn = $<HTMLButtonElement>('create-practice-exam');
const output = $('output');
const resultsEyebrow = $('results-eyebrow');
const resultsTitle = $('results-title');
const resultsMeta = $('results-meta');
const revealAllBtn = $<HTMLButtonElement>('reveal-all');

let selectedFile: File | null = null;
const selectedTopics = new Set<string>();

// ==================== HELPERS ====================

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Main-process messages start with an emoji status marker; the UI has its own styling
function cleanMessage(message: string | undefined, fallback: string): string {
    return (message || fallback).replace(/^[❌✅⚠️\s]+/u, '');
}

function notice(kind: 'progress' | 'error' | 'warn', text: string): string {
    const lead = kind === 'progress' ? '<span class="spinner"></span>' : '';
    return `<div class="notice ${kind}">${lead}<span>${escapeHtml(text)}</span></div>`;
}

function setBusy(button: HTMLButtonElement, busy: boolean, busyLabel: string) {
    if (busy) {
        button.dataset.label = button.textContent?.trim() || '';
        button.innerHTML = `<span class="spinner"></span>${escapeHtml(busyLabel)}`;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.label || '';
        button.disabled = false;
    }
}

function clampCount(value: number): number {
    if (!Number.isFinite(value)) return 10;
    return Math.min(MAX_QUESTIONS, Math.max(1, Math.round(value)));
}

function sourceLabel(source: string): string {
    if (!source) return '';
    if (source === 'generated') return '<span class="q-source">New question</span>';
    try {
        const url = new URL(source);
        return `<a class="q-source" href="${escapeHtml(url.href)}" target="_blank" title="${escapeHtml(url.href)}">${escapeHtml(url.hostname.replace(/^www\./, ''))}</a>`;
    } catch {
        return '';
    }
}

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ==================== BACKEND STATUS ====================

async function watchBackend() {
    const label = statusPill.querySelector('.status-label')!;
    const result = await window.api.backendStatus();
    statusPill.dataset.state = result.status;
    label.textContent = result.status === 'ready' ? 'Ready' : 'Offline';
    if (result.message) statusPill.title = result.message;
}

// ==================== STEP 1: SYLLABUS ====================

function chooseFile(file: File | undefined) {
    if (!file) return;
    selectedFile = file;
    dropzone.classList.add('has-file');
    dropzone.querySelector('.dropzone-title')!.textContent = file.name;
    dropzone.querySelector('.dropzone-sub')!.textContent = `${(file.size / 1024).toFixed(0)} KB · click to change`;
    analyzeBtn.disabled = false;
}

dropzone.addEventListener('click', () => syllabusInput.click());
syllabusInput.addEventListener('change', () => chooseFile(syllabusInput.files?.[0]));

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    chooseFile(e.dataTransfer?.files?.[0]);
});

function renderSyllabusSummary(data: any): string {
    const results = data?.results ?? {};
    const topics: string[] = results.course_info?.topics ?? [];
    const pdfCount = results.downloaded_pdfs?.length ?? 0;
    const questionCount = results.stored_questions?.total_questions ?? 0;

    let html = `
        <dl>
            <div class="summary-row"><dt>Course</dt><dd>${escapeHtml(data?.course_name ?? 'Unknown')}</dd></div>
            <div class="summary-row"><dt>Past exams found</dt><dd>${pdfCount}</dd></div>
            <div class="summary-row"><dt>Questions added</dt><dd>${questionCount}</dd></div>
        </dl>`;
    if (topics.length) {
        html += `<div class="chips">${topics.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>`;
    }
    if (questionCount === 0) {
        html += notice('warn', 'No past exams were found online. Learnio will write fresh questions when you generate an exam.');
    }
    return html;
}

analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    setBusy(analyzeBtn, true, 'Analyzing…');
    summary.hidden = false;
    summary.innerHTML = notice('progress', 'Reading your syllabus and searching for past exams. This can take a couple of minutes.');

    try {
        const result = await window.api.processSyllabus(await selectedFile.arrayBuffer(), selectedFile.name);
        if (result.status !== 'success') {
            summary.innerHTML = notice('error', cleanMessage(result.message, 'Failed to process the syllabus'));
            return;
        }

        summary.innerHTML = renderSyllabusSummary(result.data);
        await loadCourses();

        const courseName = result.data?.course_name;
        if (courseName) {
            courseSelect.value = courseName;
            await loadTopics(courseName);
        }
    } catch (err) {
        summary.innerHTML = notice('error', err instanceof Error ? err.message : String(err));
    } finally {
        setBusy(analyzeBtn, false, '');
    }
});

// ==================== STEP 2: EXAM SETTINGS ====================

async function loadCourses() {
    const previous = courseSelect.value;
    while (courseSelect.options.length > 1) courseSelect.remove(1);

    const result = await window.api.getCourses();
    if (result.status !== 'success') return;

    for (const course of result.courses as string[]) {
        courseSelect.add(new Option(course, course));
    }
    if (previous) courseSelect.value = previous;
}

function renderTopicChips(topics: string[]) {
    topicsBox.innerHTML = '';
    if (!topics.length) {
        topicsBox.innerHTML = '<span class="muted small">No topics saved for this course. The exam will cover everything.</span>';
        return;
    }

    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'chip active';
    allChip.textContent = 'All topics';
    topicsBox.appendChild(allChip);

    const topicChips = topics.map((topic) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = topic;
        chip.addEventListener('click', () => {
            selectedTopics.has(topic) ? selectedTopics.delete(topic) : selectedTopics.add(topic);
            chip.classList.toggle('active', selectedTopics.has(topic));
            allChip.classList.toggle('active', selectedTopics.size === 0);
        });
        topicsBox.appendChild(chip);
        return chip;
    });

    allChip.addEventListener('click', () => {
        selectedTopics.clear();
        topicChips.forEach(c => c.classList.remove('active'));
        allChip.classList.add('active');
    });
}

async function loadTopics(course: string) {
    selectedTopics.clear();
    if (!course) {
        topicsBox.innerHTML = '<span class="muted small">Select a course to see its topics</span>';
        return;
    }
    topicsBox.innerHTML = '<span class="muted small">Loading topics…</span>';
    const result = await window.api.getTopics(course);
    renderTopicChips(result.status === 'success' ? result.topics : []);
}

courseSelect.addEventListener('change', () => loadTopics(courseSelect.value));

$('num-minus').addEventListener('click', () => { numInput.value = String(clampCount(Number(numInput.value) - 1)); });
$('num-plus').addEventListener('click', () => { numInput.value = String(clampCount(Number(numInput.value) + 1)); });
numInput.addEventListener('change', () => { numInput.value = String(clampCount(Number(numInput.value))); });

// ==================== RESULTS ====================

function renderSkeletons(count: number) {
    const card = `
        <div class="skeleton">
            <div class="skeleton-line w-25"></div>
            <div class="skeleton-line w-90"></div>
            <div class="skeleton-line w-60"></div>
        </div>`;
    output.innerHTML = card.repeat(Math.min(count, 5));
}

function renderQuestion(q: ExamQuestion, index: number): string {
    const difficulty = (q.difficulty || '').toLowerCase();
    const meta = [
        difficulty ? `<span class="badge ${escapeHtml(difficulty)}"><span class="dot"></span>${escapeHtml(difficulty)}</span>` : '',
        q.topic ? `<span>${escapeHtml(q.topic)}</span>` : '',
        sourceLabel(q.source),
    ].filter(Boolean).join('<span class="sep">·</span>');

    const answer = q.answer
        ? `<div class="answer-text rich">${renderRichText(q.answer)}</div>${q.explanation ? `<div class="answer-why rich">${renderRichText(q.explanation)}</div>` : ''}`
        : '<div class="answer-why">No answer is available for this question yet.</div>';

    return `
        <article class="question">
            <div class="q-num">${String(index + 1).padStart(2, '0')}</div>
            <div>
                <div class="q-meta">${meta}</div>
                <div class="q-text rich">${renderRichText(q.question)}</div>
                <button type="button" class="link-btn" data-toggle>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    <span>Show answer</span>
                </button>
                <div class="answer">
                    <div class="answer-label">Answer</div>
                    ${answer}
                </div>
            </div>
        </article>`;
}

function setQuestionOpen(card: Element, open: boolean) {
    card.classList.toggle('open', open);
    card.querySelector('[data-toggle] span')!.textContent = open ? 'Hide answer' : 'Show answer';
}

function syncRevealAll() {
    const cards = output.querySelectorAll('.question');
    const allOpen = cards.length > 0 && Array.from(cards).every(c => c.classList.contains('open'));
    revealAllBtn.textContent = allOpen ? 'Hide all answers' : 'Show all answers';
}

output.addEventListener('click', (e) => {
    const toggle = (e.target as HTMLElement).closest('[data-toggle]');
    if (!toggle) return;
    const card = toggle.closest('.question')!;
    setQuestionOpen(card, !card.classList.contains('open'));
    syncRevealAll();
});

revealAllBtn.addEventListener('click', () => {
    const cards = Array.from(output.querySelectorAll('.question'));
    const open = !cards.every(c => c.classList.contains('open'));
    cards.forEach(c => setQuestionOpen(c, open));
    syncRevealAll();
});

function renderExam(exam: any, course: string, topics: string[]) {
    const questions: ExamQuestion[] = exam.questions ?? [];

    resultsEyebrow.textContent = topics.length ? topics.join(' · ') : 'All topics';
    resultsTitle.textContent = course;
    const parts = [plural(questions.length, 'question')];
    if (exam.from_bank) parts.push(`${exam.from_bank} from your question bank`);
    if (exam.generated) parts.push(`${exam.generated} newly written`);
    resultsMeta.textContent = parts.join(' · ');

    const warnings = (exam.warnings ?? []).map((w: string) => notice('warn', w)).join('');
    output.innerHTML = warnings + questions.map(renderQuestion).join('');
    output.querySelectorAll<HTMLElement>('.question').forEach((card, i) => {
        card.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
    });

    revealAllBtn.hidden = questions.length === 0;
    syncRevealAll();
    output.parentElement?.scrollTo({ top: 0 });
}

generateBtn.addEventListener('click', async () => {
    const course = courseSelect.value;
    if (!course) {
        output.innerHTML = notice('warn', 'Select a course first.');
        return;
    }

    const count = clampCount(Number(numInput.value));
    numInput.value = String(count);
    const topics = Array.from(selectedTopics);

    setBusy(generateBtn, true, 'Generating…');
    revealAllBtn.hidden = true;
    resultsEyebrow.textContent = 'Building your exam';
    resultsTitle.textContent = course;
    resultsMeta.textContent = `Preparing ${plural(count, 'question')} with answers…`;
    renderSkeletons(count);

    try {
        const result = await window.api.createPracticeExam({ course, topics, num_questions: count });
        if (result.status !== 'success') {
            resultsMeta.textContent = '';
            output.innerHTML = notice('error', cleanMessage(result.message, 'Failed to create the practice exam'));
            return;
        }
        renderExam(result.exam, course, topics);
    } catch (err) {
        output.innerHTML = notice('error', err instanceof Error ? err.message : String(err));
    } finally {
        setBusy(generateBtn, false, '');
    }
});

// ==================== STARTUP ====================

watchBackend();
loadCourses();
