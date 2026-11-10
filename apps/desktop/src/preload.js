const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kshareDesktop", {
  isDesktop: true,
  platform: process.platform,
  setServerUrl: (url) => ipcRenderer.send("kshare:set-server-url", url),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});
