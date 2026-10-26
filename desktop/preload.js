// Gives the page (web/native.js) a safe, small set of powers.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('memeBridge', {
  getText: (url) => ipcRenderer.invoke('getText', url),
  save: (url, name) => ipcRenderer.invoke('save', url, name),
  share: (url, title) => ipcRenderer.invoke('share', url, title),
  openFolder: () => ipcRenderer.invoke('openFolder'),
  openLink: (url) => ipcRenderer.invoke('openLink', url),
});
