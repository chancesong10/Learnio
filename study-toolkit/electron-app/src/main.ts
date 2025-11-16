import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
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
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const startUrl = `file://${path.join(__dirname, 'renderer.html')}`;
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (!mainWindow) createWindow();
});

// -------------------------
// Python helper
// -------------------------
const PYTHON_PATH = 'python';
const PYTHON_SCRIPT = path.resolve(__dirname, '..', '..', 'fastapi-backend', 'app', 'api', 'syllabus_processing.py');

function runPythonScript(scriptPath: string, args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        const pyProcess = spawn(PYTHON_PATH, [scriptPath, ...args]);

        pyProcess.stdout.on('data', data => console.log('Python version:', data.toString()));
        pyProcess.stderr.on('data', data => console.error('Python error:', data.toString()));

        let stdout = '';
        let stderr = '';

        pyProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        pyProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        pyProcess.on('close', (code: number) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error('Failed to parse Python output: ' + String(e)));
                }
            } else {
                reject(new Error(`Python script failed (code ${code}):\n${stderr}`));
            }
        });

        pyProcess.on('error', (err: Error) => {
            reject(new Error('Failed to spawn Python process: ' + err.message));
        });
    });
}

// -------------------------
// Database helper
// -------------------------
const DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'question_bank.sqlite');

function queryDatabase(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(new Error(`Failed to open database: ${err.message}`));
                return;
            }
        });

        db.all(query, params, (err, rows) => {
            if (err) {
                db.close();
                reject(new Error(`Database query failed: ${err.message}`));
                return;
            }
            db.close();
            resolve(rows || []);
        });
    });
}

// -------------------------
// HTTP helper for FastAPI calls
// -------------------------
async function callFastAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `http://localhost:8000${endpoint}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`FastAPI error: ${response.status} - ${errorText}`);
        }
        return await response.json();
    } catch (error: any) {
        throw new Error(`Failed to call FastAPI: ${error.message}`);
    }
}

// -------------------------
// IPC handlers
// -------------------------
ipcMain.handle('process-syllabus', async (event: IpcMainInvokeEvent, fileBuffer: ArrayBuffer) => {
    if (!fileBuffer) return { status: 'error', message: '❌ No file provided', data: null };

    const tempFile = path.join(os.tmpdir(), `syllabus_${Date.now()}.pdf`);

    try {
        const buffer = Buffer.from(new Uint8Array(fileBuffer));
        fs.writeFileSync(tempFile, buffer);

        const result = await runPythonScript(PYTHON_SCRIPT, [tempFile]);

        fs.unlinkSync(tempFile);
        return { status: 'success', message: '✅ Syllabus processed successfully', data: result };
    } catch (err: any) {
        try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
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
            'SELECT DISTINCT topics FROM questions WHERE course = ? AND topics IS NOT NULL AND topics != ""',
            [course]
        );
        
        let topics: string[] = [];
        
        if (rows.length > 0) {
            // Topics might be comma-separated
            const allTopics = new Set<string>();
            rows.forEach((row: any) => {
                const topicList = row.topics.split(',').map((t: string) => t.trim());
                topicList.forEach((t: string) => allTopics.add(t));
            });
            topics = Array.from(allTopics);
        }
        
        // If no topics from questions, try courses table
        if (topics.length === 0) {
            rows = await queryDatabase('SELECT topics FROM courses WHERE course = ?', [course]);
            if (rows.length > 0 && rows[0].topics) {
                topics = rows[0].topics.split(',').map((t: string) => t.trim());
            }
        }
        
        return { status: 'success', topics };
    } catch (err: any) {
        console.error('Error fetching topics:', err);
        return { status: 'error', message: err.message, topics: [] };
    }
});

// -------------------------
// Stub handlers for other features
// -------------------------
ipcMain.handle('extract-keywords', async () => ({ status: 'success', message: '✅ Backend pending', keywords: [] }));
ipcMain.handle('search-web', async () => ({ status: 'success', message: '✅ Backend pending', results: [] }));
ipcMain.handle('download-pdf', async () => ({ status: 'success', message: '✅ Backend pending' }));