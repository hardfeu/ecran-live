const path = require('node:path');
const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');

let window;
let listedVlcSources = new Map();
let selectedVlcSource = null;

function createWindow() {
  window = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 560,
    minHeight: 620,
    title: 'CinéLive VLC',
    backgroundColor: '#070a10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('closed', () => { window = null; });
}

app.whenReady().then(() => {
  app.setAppUserModelId('fr.cinelive.vlccompanion');
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (!selectedVlcSource) return callback(null);
    // Electron's loopback audio is supported on Windows and captures PC playback.
    callback({ video: selectedVlcSource, audio: 'loopback' });
  }, { useSystemPicker: false });

  ipcMain.handle('vlc:list-windows', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 360, height: 203 },
      fetchWindowIcons: true
    });
    listedVlcSources = new Map(sources
      .filter(source => /\bVLC\b/i.test(source.name))
      .map(source => [source.id, source]));
    return [...listedVlcSources.values()].map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  });

  ipcMain.handle('vlc:select-window', (_event, sourceId) => {
    const source = listedVlcSources.get(sourceId);
    if (!source) throw new Error('Cette fenêtre VLC n’est plus disponible. Actualise la liste.');
    selectedVlcSource = source;
    return source.name;
  });

  ipcMain.handle('vlc:clear-selection', () => {
    selectedVlcSource = null;
    return true;
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  selectedVlcSource = null;
  if (process.platform !== 'darwin') app.quit();
});
