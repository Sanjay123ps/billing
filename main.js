// ===== AYINI BILLING — ELECTRON MAIN PROCESS =====
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let backendServer = null;

const PORT = 5757;

// ─────────────────────────────────────────────────────────────
// Prevent multiple app instances
// ─────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Set environment variables BEFORE loading server
// ─────────────────────────────────────────────────────────────
const unpackedRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : __dirname;

process.env.AYINI_DATA_PATH = '';
process.env.PORT = PORT;
process.env.TZ = 'Asia/Kolkata';
process.env.NODE_ENV = 'production';
process.env.APP_ROOT = unpackedRoot;

process.env.SQLJS_WASM_PATH = path.join(
  unpackedRoot,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm'
);

// ─────────────────────────────────────────────────────────────
// Wait for backend server
// ─────────────────────────────────────────────────────────────
function waitForServer(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const attempt = () => {
      const request = http.get(
        `http://localhost:${port}/api/health`,
        (res) => {
          if (res.statusCode === 200) {
            return resolve();
          }
          retry();
        }
      );

      request.on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(
          new Error('Server did not respond after 20 seconds.')
        );
      }
      setTimeout(attempt, 500);
    };

    attempt();
  });
}

// ─────────────────────────────────────────────────────────────
// Start backend server
// ─────────────────────────────────────────────────────────────
function startServer() {
  try {
    const serverPath = path.join(unpackedRoot, 'server.js');

    backendServer = require(serverPath);

    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Create main app window
// ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'Ayini Billing',
    backgroundColor: '#f5f0e8',
    show: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://localhost:${PORT}`)) {
      return { action: 'allow' };
    }

    if (url.startsWith('blob:')) {
      return { action: 'allow' };
    }

    if (url === 'about:blank') {
      return { action: 'allow' };
    }

    shell.openExternal(url);

    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────
// Splash screen
// ─────────────────────────────────────────────────────────────
function createSplash() {
  const splash = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    center: true,
    resizable: false,
    backgroundColor: '#1a5c35',

    webPreferences: {
      nodeIntegration: false,
    },
  });

  splash.loadURL(`data:text/html,
  <html>
  <head>
    <style>
      *{
        margin:0;
        padding:0;
        box-sizing:border-box;
      }

      body{
        background:#1a5c35;
        color:#fff;
        font-family:'Segoe UI',sans-serif;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        height:100vh;
        user-select:none;
      }

      .leaf{
        font-size:52px;
        margin-bottom:12px;
      }

      .name{
        font-size:22px;
        font-weight:700;
        letter-spacing:1px;
      }

      .sub{
        font-size:13px;
        opacity:0.7;
        margin-top:6px;
      }

      .loader{
        margin-top:28px;
        font-size:13px;
        opacity:.6;
      }

      .dot{
        display:inline-block;
        animation:blink 1.2s infinite;
      }

      .dot:nth-child(2){
        animation-delay:.2s;
      }

      .dot:nth-child(3){
        animation-delay:.4s;
      }

      @keyframes blink{
        0%,80%,100%{
          opacity:0;
        }

        40%{
          opacity:1;
        }
      }
    </style>
  </head>

  <body>
    <div class="leaf">🌿</div>

    <div class="name">
      Ayini Home Products
    </div>

    <div class="sub">
      Billing & Inventory System
    </div>

    <div class="loader">
      Starting
      <span class="dot">.</span>
      <span class="dot">.</span>
      <span class="dot">.</span>
    </div>
  </body>
  </html>`);

  return splash;
}

// ─────────────────────────────────────────────────────────────
// Bootstrap app
// ─────────────────────────────────────────────────────────────
async function bootstrap() {
  const splash = createSplash();

  try {
    await startServer();

    await waitForServer(PORT);

    createWindow();

    splash.close();
  } catch (err) {
    splash.close();

    dialog.showErrorBox(
      'Ayini Billing — Startup Failed',
      `Could not start the billing server.\n\nError: ${err.message}\n\nPlease restart the application.`
    );

    app.quit();
  }
}

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  process.env.AYINI_DATA_PATH = app.getPath('userData');

  bootstrap();
});

// Close backend server properly
app.on('before-quit', () => {
  if (backendServer && backendServer.close) {
    backendServer.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
