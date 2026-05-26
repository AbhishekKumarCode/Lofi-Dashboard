// ============================================================
//  LOFI DASHBOARD — DESKTOP CONTROL PANEL
//  main.js  (Electron main process)
// ============================================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

let win        = null;
let serverProc = null;

// ── Find server.js ───────────────────────────────────────────
function findServer() {
  const candidates = [
    path.join(path.dirname(process.execPath), '..', 'dashboard-server', 'server.js'),
    path.join(path.dirname(process.execPath), 'dashboard-server', 'server.js'),
    path.join(__dirname, '..', 'dashboard-server', 'server.js'),
    'C:\\Lofi-Dashboard\\dashboard-server\\server.js',
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || '';
}

// ── Send to renderer safely ───────────────────────────────────
function send(ch, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(ch, ...args);
}

// ── Server control ───────────────────────────────────────────
function startServer() {
  if (serverProc) return;
  const serverJs = findServer();
  if (!serverJs) {
    send('log', '[panel] ❌ server.js not found\n');
    send('status', 'error');
    return;
  }
  send('log', `[panel] starting → ${serverJs}\n`);
  serverProc = spawn('node', [serverJs], { cwd: path.dirname(serverJs), env: process.env });
  serverProc.stdout.on('data', d => send('log', d.toString()));
  serverProc.stderr.on('data', d => send('log', '[err] ' + d.toString()));
  serverProc.on('exit', code => {
    serverProc = null;
    send('log', `[panel] server stopped (${code})\n`);
    send('status', 'stopped');
  });
  send('status', 'running');
}

function stopServer() {
  if (!serverProc) return;
  serverProc.kill();
  serverProc = null;
  send('status', 'stopped');
}

// ── Window ───────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 860, height: 580,
    minWidth: 680, minHeight: 460,
    frame: false,
    backgroundColor: '#080610',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer.html'));
  win.on('closed', () => { win = null; });
}

// ── App lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  win.webContents.once('did-finish-load', () => startServer());
});
app.on('before-quit', stopServer);
app.on('window-all-closed', () => { stopServer(); app.quit(); });

// ── IPC ──────────────────────────────────────────────────────
ipcMain.on('win-close',      () => { stopServer(); win && win.close(); });
ipcMain.on('win-minimize',   () => win && win.minimize());
ipcMain.on('server-start',   () => startServer());
ipcMain.on('server-stop',    () => stopServer());
ipcMain.on('server-restart', () => { stopServer(); setTimeout(startServer, 500); });
ipcMain.on('open-dashboard', () => shell.openExternal('http://192.168.1.13:3000'));
