// ============================================================
//  LOFI DASHBOARD — DESKTOP CONTROL PANEL
//  main.js  (Electron main process)
// ============================================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

const GITHUB_OWNER = 'AbhishekKumarCode';
const GITHUB_REPO  = 'Lofi-Dashboard';
const CONFIG_FILE  = path.join(app.getPath('userData'), 'lofi-panel-config.json');

let win        = null;
let serverProc = null;

// ── Config ───────────────────────────────────────────────────
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { token: '', serverPath: '' }; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }
  catch (e) { console.error('config save failed', e); }
}

// ── Resolve server.js path ───────────────────────────────────
function findServer(saved) {
  const candidates = [
    saved,
    path.join(path.dirname(process.execPath), '..', 'dashboard-server', 'server.js'),
    path.join(path.dirname(process.execPath), 'dashboard-server', 'server.js'),
    path.join(__dirname, '..', 'dashboard-server', 'server.js'),
    'C:\\Lofi-Dashboard\\dashboard-server\\server.js',
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || '';
}

// ── Server control ───────────────────────────────────────────
function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function startServer() {
  if (serverProc) return;
  const cfg      = loadConfig();
  const serverJs = findServer(cfg.serverPath);
  if (!serverJs) {
    send('log', '[panel] ❌ server.js not found — enter the path in Settings and try again.\n');
    send('status', 'error');
    return;
  }
  send('log', `[panel] starting server → ${serverJs}\n`);
  serverProc = spawn('node', [serverJs], {
    cwd: path.dirname(serverJs),
    env: process.env,
  });
  serverProc.stdout.on('data', d => send('log', d.toString()));
  serverProc.stderr.on('data', d => send('log', '[err] ' + d.toString()));
  serverProc.on('exit', code => {
    serverProc = null;
    send('log', `[panel] server exited (code ${code})\n`);
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
    width: 920, height: 600,
    minWidth: 700, minHeight: 480,
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
  win.webContents.once('did-finish-load', () => {
    send('config-loaded', loadConfig());
    startServer();
  });
});
app.on('before-quit', stopServer);
app.on('window-all-closed', () => { stopServer(); app.quit(); });

// ── IPC — window controls ────────────────────────────────────
ipcMain.on('win-close',    () => { stopServer(); win && win.close(); });
ipcMain.on('win-minimize', () => win && win.minimize());

// ── IPC — server ─────────────────────────────────────────────
ipcMain.on('server-start', () => startServer());
ipcMain.on('server-stop',  () => stopServer());
ipcMain.on('server-restart', () => { stopServer(); setTimeout(startServer, 600); });
ipcMain.on('open-dashboard', () => shell.openExternal('http://192.168.1.13:3000'));

// ── IPC — config ─────────────────────────────────────────────
ipcMain.on('save-config', (_, cfg) => {
  saveConfig(cfg);
  send('config-loaded', cfg);
});

// ── IPC — GitHub helpers ─────────────────────────────────────
function ghRequest(options, body) {
  return new Promise(resolve => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    if (body) req.write(body);
    req.end();
  });
}

function ghHeaders(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'LofiControlPanel/1.0',
  };
}

// Trigger APK build
ipcMain.handle('trigger-build', async (_, token) => {
  const body = JSON.stringify({ ref: 'main' });
  const res  = await ghRequest({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/build.yml/dispatches`,
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  return { ok: res.status === 204, status: res.status };
});

// Get latest workflow run
ipcMain.handle('get-latest-run', async (_, token) => {
  const res = await ghRequest({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?per_page=3&branch=main`,
    method: 'GET',
    headers: ghHeaders(token),
  });
  if (!res.body || !res.body.workflow_runs) return null;
  const run = res.body.workflow_runs.find(r => r.name === 'Build APK') || res.body.workflow_runs[0];
  return run ? { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, updatedAt: run.updated_at } : null;
});

// Get download URL for APK artifact
ipcMain.handle('get-apk-url', async (_, { token, runId }) => {
  const res = await ghRequest({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts`,
    method: 'GET',
    headers: ghHeaders(token),
  });
  if (!res.body || !res.body.artifacts) return null;
  const apk = res.body.artifacts.find(a => a.name.toLowerCase().includes('apk')) || res.body.artifacts[0];
  return apk ? { url: apk.archive_download_url, name: apk.name } : null;
});

// Open URL in default browser
ipcMain.handle('open-url', (_, url) => shell.openExternal(url));
