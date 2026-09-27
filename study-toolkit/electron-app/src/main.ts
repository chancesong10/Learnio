import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, nativeTheme, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null;

// -------------------------
// Create main window
// -------------------------
function createWindow() {
    nativeTheme.themeSource = 'dark';  // dark native title bar
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        title: 'Learnio',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const startUrl = `file://${path.join(__dirname, 'renderer.html')}`;
    mainWindow.loadURL(startUrl);

    // Source links open in the user's browser, never inside the app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== startUrl) event.preventDefault();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    backendReady = startBackend();
    createWindow();
});
app.on('will-quit', stopBackend);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (!mainWindow) createWindow();
});

// -------------------------
// Database helper
// -------------------------
const DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'question_bank.sqlite');

function queryDatabase(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (openErr) => {
            if (openErr) {
                reject(new Error(`Failed to open database: ${openErr.message}`));
                return;
            }

            db.all(query, params, (err, rows) => {
                db.close();
                if (err) {
                    reject(new Error(`Database query failed: ${err.message}`));
                    return;
                }
                resolve(rows || []);
            });
        });
    });
}

// -------------------------
// HTTP helper for FastAPI calls
// -------------------------
const API_BASE_URL = 'http://127.0.0.1:8000';

// -------------------------
// Backend process: started with the app, stopped when it quits
// -------------------------
const BACKEND_DIR = path.resolve(__dirname, '..', '..', 'fastapi-backend');
const PYTHON = process.env.LEARNIO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const BACKEND_START_TIMEOUT_MS = 60_000;

let backendProcess: ChildProcess | null = null;
let backendReady: Promise<void> = Promise.resolve();
let backendOutput = '';  // recent output, shown if the backend fails to start

async function isBackendUp(): Promise<boolean> {
    try {
        return (await fetch(`${API_BASE_URL}/`)).ok;
    } catch {
        return false;
    }
}

async function startBackend(): Promise<void> {
    // A backend started by hand (e.g. while developing) is reused
    if (await isBackendUp()) return;

    const child = spawn(PYTHON, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: BACKEND_DIR,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        windowsHide: true,
    });
    backendProcess = child;

    const record = (data: Buffer) => {
        const text = data.toString();
        process.stdout.write(`[backend] ${text}`);
        backendOutput = (backendOutput + text).slice(-2000);
    };
    child.stdout?.on('data', record);
    child.stderr?.on('data', record);

    let exitError: Error | null = null;
    child.on('error', (err) => {
        exitError = new Error(`Could not start Python ("${PYTHON}"): ${err.message}. Is Python installed?`);
    });
    child.on('exit', (code) => {
        backendProcess = null;
        const lastLines = backendOutput.trim().split('\n').slice(-5).join('\n');
        exitError ??= new Error(`The backend stopped (exit code ${code}).\n${lastLines}`);
    });

    const deadline = Date.now() + BACKEND_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (exitError) throw exitError;
        if (await isBackendUp()) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('The backend took too long to start.');
}

function stopBackend() {
    backendProcess?.kill();
    backendProcess = null;
}

async function callFastAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const options: RequestInit = { method };

    if (body instanceof FormData) {
        // fetch sets the multipart Content-Type (with boundary) itself
        options.body = body;
    } else if (body !== undefined && method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }

    try {
        await backendReady;
    } catch (error: any) {
        throw new Error(`The backend could not start: ${error.message}`);
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    } catch (error: any) {
        throw new Error(
            `Could not reach the backend at ${API_BASE_URL} (${error.message}). ` +
            'Try restarting the app.'
        );
    }

    if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try { detail = JSON.parse(errorText).detail ?? errorText; } catch {}
        throw new Error(`Backend error ${response.status}: ${detail}`);
    }
    return await response.json();
}

// -------------------------
// IPC handlers
// -------------------------
ipcMain.handle('backend-status', async () => {
    try {
        await backendReady;
        return { status: 'ready' };
    } catch (err: any) {
        return { status: 'error', message: err.message || String(err) };
    }
});

// Runs the full pipeline: analyze syllabus -> search past exams -> download -> extract questions
ipcMain.handle('process-syllabus', async (event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer, fileName?: string) => {
    if (!fileBuffer) return { status: 'error', message: '❌ No file provided', data: null };

    try {
        const form = new FormData();
        form.append('syllabus', new Blob([fileBuffer], { type: 'application/pdf' }), fileName || 'syllabus.pdf');

        const result = await callFastAPI('/api/process-syllabus-pipeline/', 'POST', form);
        return { status: 'success', message: '✅ Syllabus processed successfully', data: result };
    } catch (err: any) {
        return { status: 'error', message: '❌ ' + (err.message || String(err)), data: null };
    }
});

ipcMain.handle('create-practice-exam', async (event: IpcMainInvokeEvent, params: any) => {
    try {
        const { course, topics, num_questions } = params;
        
        if (!course) {
            return { status: 'error', message: '❌ Course is required', exam: null };
        }
        
        const requestBody = {
            course,
            topics: topics || [],
            num_questions: num_questions || 20
        };
        
        console.log('Creating practice exam with:', requestBody);
        
        const result = await callFastAPI('/create-practice-exam/', 'POST', requestBody);
        
        return { status: 'success', message: '✅ Practice exam created', exam: result };
    } catch (err: any) {
        console.error('Error creating practice exam:', err);
        return { status: 'error', message: '❌ ' + (err.message || String(err)), exam: null };
    }
});

// NEW: Get all courses from database
ipcMain.handle('get-courses', async (event: IpcMainInvokeEvent) => {
    try {
        // OPTION 1: Only get courses from courses table (syllabus uploads)
        const rows = await queryDatabase('SELECT DISTINCT course FROM courses WHERE course IS NOT NULL AND course != "" ORDER BY course');
        
        const courses = rows.map((row: any) => row.course);
        
        console.log('Found courses from courses table:', courses);
        return { status: 'success', courses };
    } catch (err: any) {
        console.error('Error fetching courses:', err);
        return { status: 'error', message: err.message, courses: [] };
    }
});

// NEW: Get topics for a specific course
ipcMain.handle('get-topics', async (event: IpcMainInvokeEvent, course: string) => {
    try {
        // First try questions table
        let rows = await queryDatabase(
            'SELECT DISTINCT topics FROM questions WHERE course = ? COLLATE NOCASE AND topics IS NOT NULL AND topics != ""',
            [course]
        );
        
        let topics: string[] = [];
        
        if (rows.length > 0) {
            // Topics might be comma-separated
            const allTopics = new Set<string>();
            rows.forEach((row: any) => {
                const topicList = row.topics.split(',').map((t: string) => t.trim());
                topicList.filter(Boolean).forEach((t: string) => allTopics.add(t));
            });
            topics = Array.from(allTopics);
        }
        
        // If no topics from questions, try courses table
        if (topics.length === 0) {
            rows = await queryDatabase('SELECT topics FROM courses WHERE course = ? COLLATE NOCASE', [course]);
            if (rows.length > 0 && rows[0].topics) {
                topics = rows[0].topics.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
        }
        
        return { status: 'success', topics };
    } catch (err: any) {
        console.error('Error fetching topics:', err);
        return { status: 'error', message: err.message, topics: [] };
    }
});

// -------------------------
// Other backend features
// -------------------------
ipcMain.handle('extract-keywords', async (event: IpcMainInvokeEvent, text: string) => {
    try {
        const keywords = await callFastAPI('/extract_keywords/', 'POST', { text });
        return { status: 'success', keywords };
    } catch (err: any) {
        return { status: 'error', message: '❌ ' + (err.message || String(err)), keywords: [] };
    }
});

ipcMain.handle('search-web', async (event: IpcMainInvokeEvent, courseName: string) => {
    try {
        const results = await callFastAPI(`/search?course_name=${encodeURIComponent(courseName)}`);
        return { status: 'success', results };
    } catch (err: any) {
        return { status: 'error', message: '❌ ' + (err.message || String(err)), results: {} };
    }
});

ipcMain.handle('generate-flashcards', async (event: IpcMainInvokeEvent, notes: string[]) => {
    try {
        const flashcards = await callFastAPI('/generate_flashcards', 'POST', notes);
        return { status: 'success', flashcards };
    } catch (err: any) {
        return { status: 'error', message: '❌ ' + (err.message || String(err)), flashcards: [] };
    }
});
