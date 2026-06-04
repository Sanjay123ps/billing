// ===== AYINI BILLING — PRELOAD SCRIPT =====
// Runs in renderer context with access to Node APIs
// contextBridge safely exposes only what the web page needs

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform:   process.platform, // 'win32', 'darwin', 'linux'
  version:    process.versions.electron,
});
