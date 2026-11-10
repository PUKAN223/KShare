const {
  app,
  BrowserWindow,
  desktopCapturer,
  session,
  Tray,
  Menu,
  nativeImage,
  shell,
  ipcMain,
  globalShortcut
} = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let tray = null;
let isQuitting = false;

function getBuildConfigUrl() {
  try {
    const configPath = path.join(__dirname, "config.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (data.defaultWebUrl) return data.defaultWebUrl;
    }
  } catch {
    // ignore
  }
  return "http://localhost:3000";
}

function getUserConfigPath() {
  return path.join(app.getPath("userData"), "kshare-settings.json");
}

function getSavedWebUrl() {
  if (process.env.KSHARE_WEB_URL) {
    return process.env.KSHARE_WEB_URL.trim();
  }
  try {
    const p = getUserConfigPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (data.webUrl && typeof data.webUrl === "string") {
        return data.webUrl.trim();
      }
    }
  } catch {
    // ignore
  }
  return getBuildConfigUrl();
}

function saveUserWebUrl(url) {
  try {
    const cleaned = url.trim().replace(/\/+$/, "");
    fs.writeFileSync(
      getUserConfigPath(),
      JSON.stringify({ webUrl: cleaned }, null, 2),
      "utf8"
    );
    return cleaned;
  } catch (err) {
    console.error("Failed to save user webUrl:", err);
    return url;
  }
}

function getServerSetupHtml(currentUrl, errorText = "") {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>ตั้งค่าเซิร์ฟเวอร์ KShare</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body {
      margin: 0; min-height: 100vh; background: #09090b; color: #f4f4f5;
      display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .card {
      width: 100%; max-width: 440px; background: #18181b;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    h2 { margin: 0 0 6px; font-size: 18px; color: #fff; }
    p { margin: 0 0 16px; font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    .err {
      background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.3);
      color: #fda4af; padding: 10px 12px; border-radius: 10px; font-size: 12px; margin-bottom: 14px;
    }
    label { display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 6px; }
    input {
      width: 100%; height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
      background: #09090b; color: #fff; padding: 0 12px; font-size: 13px; font-family: monospace;
      margin-bottom: 16px; outline: none;
    }
    input:focus { border-color: #f59e0b; }
    .btns { display: flex; justify-content: flex-end; gap: 8px; }
    button {
      height: 38px; padding: 0 16px; border-radius: 10px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .primary { background: #f59e0b; color: #09090b; }
    .primary:hover { background: #fbbf24; }
    .secondary { background: #27272a; color: #d4d4d8; }
    .secondary:hover { background: #3f3f46; }
  </style>
</head>
<body>
  <div class="card">
    <h2>ตั้งค่า URL ของ KShare Server</h2>
    <p>ระบุ URL ของเว็บเซิร์ฟเวอร์ Production หรือ IP ในวง LAN (กด Ctrl+Shift+U เพื่อเปิดหน้านี้ได้ตลอดเวลา)</p>
    ${errorText ? `<div class="err">${errorText}</div>` : ""}
    <form id="form">
      <label>Server URL (KSHARE_WEB_URL)</label>
      <input id="urlInput" type="url" required value="${currentUrl}" placeholder="https://kshare.example.com หรือ http://localhost:3000" />
      <div class="btns">
        <button type="button" class="secondary" id="resetBtn">ค่าเริ่มต้น</button>
        <button type="submit" class="primary">บันทึกและเชื่อมต่อ</button>
      </div>
    </form>
  </div>
  <script>
    const form = document.getElementById("form");
    const input = document.getElementById("urlInput");
    const resetBtn = document.getElementById("resetBtn");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.kshareDesktop?.setServerUrl(input.value);
    });
    resetBtn.addEventListener("click", () => {
      input.value = "${getBuildConfigUrl()}";
    });
  </script>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function showServerSetupPage(errorText = "") {
  if (!mainWindow) return;
  const currentUrl = getSavedWebUrl();
  mainWindow.show();
  mainWindow.loadURL(getServerSetupHtml(currentUrl, errorText));
}

function resolveIconPath() {
  const localIcon = path.join(__dirname, "../assets/icon.png");
  const webIcon = path.resolve(__dirname, "../../web/public/scius-logo.png");

  if (!fs.existsSync(localIcon) && fs.existsSync(webIcon)) {
    fs.mkdirSync(path.dirname(localIcon), { recursive: true });
    fs.copyFileSync(webIcon, localIcon);
  }
  return fs.existsSync(localIcon) ? localIcon : webIcon;
}

function setupScreenSharePermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = [
      "media",
      "display-capture",
      "AudioCapture",
      "VideoCapture",
      "fullscreen",
      "clipboard-sanitized-write"
    ];
    callback(allowed.includes(permission));
  });

  defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 320, height: 180 }
        });

        if (!sources || sources.length === 0) {
          callback({});
          return;
        }

        callback({
          video: sources[0],
          audio: "loopback"
        });
      } catch (err) {
        console.error("Failed to select desktop capture source:", err);
        callback({});
      }
    },
    { useSystemPicker: true }
  );
}

function createTray(iconPath) {
  if (!fs.existsSync(iconPath)) return;

  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  tray = new Tray(image);
  tray.setToolTip("KShare — Screen Sharing");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "เปิดหน้าต่าง KShare",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: "ตั้งค่า URL เซิร์ฟเวอร์ (Ctrl+Shift+U)",
      click: () => {
        showServerSetupPage();
      }
    },
    {
      label: "รีโหลดหน้าจอ",
      click: () => {
        mainWindow?.loadURL(getSavedWebUrl());
      }
    },
    { type: "separator" },
    {
      label: "ออกจากโปรแกรม",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

function createMainWindow(iconPath) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    title: "KShare",
    backgroundColor: "#09090b",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const targetUrl = getSavedWebUrl();
  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL && validatedURL.startsWith("data:")) return;
      showServerSetupPage(
        `ไม่สามารถเชื่อมต่อ ${validatedURL || targetUrl} ได้ (${errorDescription || errorCode})`
      );
    }
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

ipcMain.on("kshare:set-server-url", (_event, newUrl) => {
  if (typeof newUrl === "string" && newUrl.trim()) {
    const saved = saveUserWebUrl(newUrl);
    mainWindow?.loadURL(saved);
  }
});

app.whenReady().then(() => {
  app.setName("KShare");
  const iconPath = resolveIconPath();

  if (process.platform === "darwin" && app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }

  setupScreenSharePermissions();
  createMainWindow(iconPath);
  createTray(iconPath);

  globalShortcut.register("CommandOrControl+Shift+U", () => {
    showServerSetupPage();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(iconPath);
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
