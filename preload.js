const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shieldAPI', {
  getInitialData: () => ipcRenderer.invoke('get-stats'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  restartProxy: () => ipcRenderer.invoke('restart-proxy'),
  banIp: (ip) => ipcRenderer.invoke('ban-ip', ip),
  unbanIp: (ip) => ipcRenderer.invoke('unban-ip', ip),
  gitPull: () => ipcRenderer.invoke('git-pull'),
  gitPush: (commitMsg) => ipcRenderer.invoke('git-push', commitMsg),
  onStatsUpdate: (callback) => {
    ipcRenderer.on('stats-update', (event, data) => callback(data));
  }
});
