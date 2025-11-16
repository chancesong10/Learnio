import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow;
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
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('activate', () => {
    if (!mainWindow)
        createWindow();
});
// -------------------------
// Python helper
// -------------------------
// Set this to your Python 3.11 executable
const PYTHON_PATH = 'python';
// Calculate the correct path to the sibling fastapi-backend folder
const PYTHON_SCRIPT = path.resolve(__dirname, '..', '..', 'fastapi-backend', 'app', 'api', 'syllabus_processing.py');
function runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
        const pyProcess = spawn(PYTHON_PATH, [scriptPath, ...args]);
        pyProcess.stdout.on('data', data => console.log('Python version:', data.toString()));
        pyProcess.stderr.on('data', data => console.error('Python error:', data.toString()));
        let stdout = '';
        let stderr = '';
        pyProcess.stdout.on('data', (data) => { stdout += data.toString(); });
        pyProcess.stderr.on('data', (data) => { stderr += data.toString(); });
        pyProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdout));
                }
                catch (e) {
                    reject(new Error('Failed to parse Python output: ' + String(e)));
                }
            }
            else {
                reject(new Error(`Python script failed (code ${code}):\n${stderr}`));
            }
        });
        pyProcess.on('error', (err) => {
            reject(new Error('Failed to spawn Python process: ' + err.message));
        });
    });
}
// -------------------------
// IPC handlers
// -------------------------
ipcMain.handle('process-syllabus', async (event, fileBuffer) => {
    if (!fileBuffer)
        return { status: 'error', message: '❌ No file provided', data: null };
    const tempFile = path.join(os.tmpdir(), `syllabus_${Date.now()}.pdf`);
    try {
        // Convert ArrayBuffer to Node Buffer
        const buffer = Buffer.from(new Uint8Array(fileBuffer));
        fs.writeFileSync(tempFile, buffer);
        const result = await runPythonScript(PYTHON_SCRIPT, [tempFile]);
        fs.unlinkSync(tempFile);
        return { status: 'success', message: '✅ Syllabus processed successfully', data: result };
    }
    catch (err) {
        try {
            if (fs.existsSync(tempFile))
                fs.unlinkSync(tempFile);
        }
        catch { }
        return { status: 'error', message: '❌ ' + (err.message || String(err)), data: null };
    }
});
// -------------------------
// Stub handlers for other features
// -------------------------
ipcMain.handle('extract-keywords', async () => ({ status: 'success', message: '✅ Backend pending', keywords: [] }));
ipcMain.handle('search-web', async () => ({ status: 'success', message: '✅ Backend pending', results: [] }));
ipcMain.handle('download-pdf', async () => ({ status: 'success', message: '✅ Backend pending' }));
ipcMain.handle('create-practice-exam', async () => ({ status: 'success', message: '✅ Backend pending', exam: null }));
