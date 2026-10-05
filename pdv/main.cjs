const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carrega o arquivo index.html compilado pelo Vite
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  
  // Ouve o comando de impressão silenciosa
  ipcMain.on('print-silent', (event) => {
    event.sender.print({ silent: true, marginType: 'printableArea' });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
