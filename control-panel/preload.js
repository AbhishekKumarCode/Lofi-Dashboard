// preload.js — secure bridge between renderer and main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // window
  close:    ()    => ipcRenderer.send('win-close'),
  minimize: ()    => ipcRenderer.send('win-minimize'),

  // server
  startServer:   ()  => ipcRenderer.send('server-start'),
  stopServer:    ()  => ipcRenderer.send('server-stop'),
  restartServer: ()  => ipcRenderer.send('server-restart'),
  openDashboard: ()  => ipcRenderer.send('open-dashboard'),

  // config
  saveConfig: (cfg) => ipcRenderer.send('save-config', cfg),

  // github (async)
  triggerBuild:  (token)          => ipcRenderer.invoke('trigger-build', token),
  getLatestRun:  (token)          => ipcRenderer.invoke('get-latest-run', token),
  getApkUrl:     (token, runId)   => ipcRenderer.invoke('get-apk-url', { token, runId }),
  openUrl:       (url)            => ipcRenderer.invoke('open-url', url),

  // events from main → renderer
  on: (channel, fn) => {
    const allowed = ['log', 'status', 'config-loaded'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, ...args) => fn(...args));
  },
});
