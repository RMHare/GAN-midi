import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let backendProcess;

const isDev = !app.isPackaged;
const BACKEND_PORT = process.env.BACKEND_PORT || '8000';

function startBackend() {
  if (backendProcess) {
    return;
  }

  if (app.isPackaged) {
    const executableName = process.platform === 'win32' ? 'backend-service.exe' : 'backend-service';
    const candidate = path.join(process.resourcesPath, 'backend', executableName);
    if (fs.existsSync(candidate)) {
      backendProcess = spawn(candidate, [], {
        env: { ...process.env, PORT: BACKEND_PORT },
        stdio: 'inherit'
      });
      return;
    }
  }

  const pythonBin = process.env.BACKEND_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const script = path.resolve(__dirname, '../../backend/run_app.py');
  backendProcess = spawn(pythonBin, [script], {
    env: { ...process.env, PORT: BACKEND_PORT },
    stdio: 'inherit'
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = undefined;
  }
}

async function createWindow() {
  startBackend();

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    await window.loadURL('http://localhost:5173');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  stopBackend();
});
