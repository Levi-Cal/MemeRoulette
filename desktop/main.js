// Meme Roulette for Windows: a window showing the shared web/ viewer,
// plus internet access and saving to Pictures\Meme Roulette.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const UA = 'windows:com.levi.memeroulette:1.0 (personal meme viewer)';
const WEB = fs.existsSync(path.join(__dirname, 'web')) ? path.join(__dirname, 'web') : path.join(__dirname, '..', 'web');

let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.setAppUserModelId('com.levi.memeroulette.desktop');

function saveDir() {
  const dir = path.join(app.getPath('pictures'), 'Meme Roulette');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function get(url, max) {
  if (!/^https:\/\//i.test(url)) throw new Error('Only https links');
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new Error('File too big');
  return buf;
}

app.whenReady().then(() => {
  ipcMain.handle('getText', async (_e, url) => (await get(url, 5_000_000)).toString('utf8'));

  ipcMain.handle('save', async (_e, url, name) => {
    const safe = String(name).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'meme.jpg';
    const data = await get(url, 40_000_000);
    fs.writeFileSync(path.join(saveDir(), safe), data);
    return 'Pictures\\Meme Roulette';
  });

  ipcMain.handle('openFolder', () => shell.openPath(saveDir()));
  ipcMain.handle('openLink', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });
  ipcMain.handle('share', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });

  win = new BrowserWindow({
    width: 960,
    height: 900,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: '#0E0E11',
    title: 'Meme Roulette',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(WEB, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
});

app.on('window-all-closed', () => app.quit());
