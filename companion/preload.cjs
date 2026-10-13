const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cinelive', {
  listVlcWindows: () => ipcRenderer.invoke('vlc:list-windows'),
  selectVlcWindow: id => ipcRenderer.invoke('vlc:select-window', id),
  clearVlcSelection: () => ipcRenderer.invoke('vlc:clear-selection')
});
