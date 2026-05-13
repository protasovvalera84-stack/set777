/**
 * Meshlink Desktop — Electron main process
 *
 * Wraps the web app in a native window.
 * Connects to the server URL configured at build time.
 */

const { app, BrowserWindow, shell, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

// Server URL — replaced at build time by setup.sh
const SERVER_URL = "__MESHLINK_SERVER_URL__";

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: "Meshlink",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  // Load the web app
  mainWindow.loadURL(SERVER_URL);

  // Show when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Handle navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(SERVER_URL) && !url.startsWith("data:")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("close", (event) => {
    // Minimize to tray instead of closing
    if (process.platform !== "darwin") {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, "icon.png");
    if (!fs.existsSync(iconPath)) return;
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Meshlink");
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open Meshlink", click: () => { if (mainWindow) mainWindow.show(); } },
      { type: "separator" },
      { label: "Quit", click: () => { app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("click", () => { if (mainWindow) mainWindow.show(); });
  } catch { /* tray not supported */ }
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    // Remove default menu
    Menu.setApplicationMenu(null);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});

// Handle certificate errors for self-signed certs
app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith(SERVER_URL)) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
