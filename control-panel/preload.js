const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  close:         () => ipcRenderer.send('win-close'),
  minimize:      () => ipcRenderer.send('win-minimize'),
  startServer:   () => ipcRenderer.send('server-start'),
  stopServer:    () => ipcRenderer.send('server-stop'),
  restartServer: () => ipcRenderer.send('server-restart'),
  openDashboard: () => ipcRenderer.send('open-dashboard'),
  on: (channel, fn) => {
    if (['status', 'log'].includes(channel))
      ipcRenderer.on(channel, (_, ...args) => fn(...args));
  },
});
