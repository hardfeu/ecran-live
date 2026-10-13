const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');
const execFileAsync = promisify(execFile);

let window;
let listedVlcSources = new Map();
let selectedVlcSource = null;

async function maximizeVlcWindow(title) {
  const script = [
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class CineliveWindowApi { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string windowName); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int command); }\'',
    '$handle = [CineliveWindowApi]::FindWindow($null, $env:CINELIVE_WINDOW_TITLE)',
    'if ($handle -eq [IntPtr]::Zero) { exit 3 }',
    '[void][CineliveWindowApi]::ShowWindowAsync($handle, 3)',
    'Start-Sleep -Milliseconds 350'
  ].join('; ');
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, CINELIVE_WINDOW_TITLE: title },
      windowsHide: true,
      timeout: 5000
    });
    return true;
  } catch (error) {
    console.warn('Impossible d’agrandir automatiquement la fenêtre VLC', error.message);
    return false;
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 560,
    minHeight: 620,
    title: 'CinéLive — Connexion',
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

  ipcMain.handle('vlc:select-window', async (_event, sourceId) => {
    const source = listedVlcSources.get(sourceId);
    if (!source) throw new Error('Cette fenêtre VLC n’est plus disponible. Actualise la liste.');
    selectedVlcSource = source;
    const maximized = await maximizeVlcWindow(source.name);
    return { name: source.name, maximized };
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
