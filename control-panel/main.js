// ============================================================
//  LOFI DASHBOARD — DESKTOP CONTROL PANEL
//  main.js  (Electron main process)
// ============================================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

let win        = null;
let serverStarted = false;

// ── Path helpers ─────────────────────────────────────────────
function getStaticDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'dashboard-server')
    : path.join(__dirname, '..', 'dashboard-server');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// ── Send to renderer safely ───────────────────────────────────
function send(ch, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(ch, ...args);
}

// ── Server control (in-process) ───────────────────────────────
function startServer() {
  if (serverStarted) return;
  serverStarted = true;

  const staticDir   = getStaticDir();
  const settingsPath = getSettingsPath();

  send('log', `[panel] staticDir  → ${staticDir}\n`);
  send('log', `[panel] settings   → ${settingsPath}\n`);

  if (!fs.existsSync(staticDir)) {
    send('log', `[panel] ❌ Dashboard files not found at ${staticDir}\n`);
    send('status', 'error');
    return;
  }

  try {
    const startServerFn = require('./server-runner.js');
    startServerFn(staticDir, settingsPath, function(port, err) {
      if (err && err.code === 'EADDRINUSE') {
        send('log', `[panel] ⚠ Port ${port} already in use — dashboard already running\n`);
        send('log', `[panel] 📱 Tablet connects → http://192.168.1.13:${port}\n`);
        send('status', 'running');
        return;
      }
      send('log', `[panel] ✅ Server running → http://localhost:${port}\n`);
      send('log', `[panel] 📱 Tablet connects → http://192.168.1.13:${port}\n`);
      send('status', 'running');
    });
  } catch (err) {
    send('log', `[panel] ❌ Failed to start server: ${err.message}\n`);
    send('status', 'error');
  }
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
app.on('window-all-closed', () => app.quit());

// ── IPC ──────────────────────────────────────────────────────
ipcMain.on('win-close',      () => { win && win.close(); app.quit(); });
ipcMain.on('win-minimize',   () => win && win.minimize());
ipcMain.on('server-start',   () => startServer());
ipcMain.on('server-stop',    () => send('log', '[panel] Server runs for the lifetime of this app.\n'));
ipcMain.on('server-restart', () => send('log', '[panel] Restart: close and reopen the app.\n'));
ipcMain.on('open-dashboard', () => shell.openExternal('http://192.168.1.13:3000'));
