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
}

// Fila assíncrona para garantir que múltiplas impressões não travem o spooler do Windows/Chromium
let isPrinting = false;
const printQueue = [];

function processPrintQueue() {
  if (isPrinting || printQueue.length === 0) return;
  const item = printQueue.shift();
  isPrinting = true;

  const win = BrowserWindow.fromWebContents(item.sender);
  if (!win || win.isDestroyed()) {
    isPrinting = false;
    setTimeout(processPrintQueue, 100);
    return;
  }

  const printOptions = {
    silent: true,
    printBackground: true,
    color: false,
    margins: { marginType: 'printableArea' }
  };

  win.webContents.print(printOptions, (success, failureReason) => {
    isPrinting = false;
    if (!success) {
      console.warn('[ELECTRON PRINT] Impressão silenciosa falhou ou foi cancelada:', failureReason);
      // Se a impressora padrão estiver com falha e não for cancelamento proposital, tenta diálogo normal
      if (failureReason && failureReason !== 'cancelled') {
        try {
          win.webContents.print({ silent: false, printBackground: true });
        } catch (e) {
          console.error('[ELECTRON PRINT] Erro no fallback de diálogo:', e.message);
        }
      }
    }
    if (!item.sender.isDestroyed()) {
      item.sender.send('print-completed', { success, failureReason });
    }
    // Libera a fila com intervalo de segurança de 300ms
    setTimeout(processPrintQueue, 300);
  });
}

// Ouve o comando de impressão vindo do React
ipcMain.on('print-silent', (event) => {
  printQueue.push({ sender: event.sender });
  processPrintQueue();
});

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
