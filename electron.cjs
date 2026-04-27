const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Read server URL from config file or use default
function getServerUrl() {
  // Check for config file next to executable
  const configPaths = [
    path.join(app.isPackaged ? path.dirname(process.execPath) : __dirname, "meshlink.conf"),
    path.join(app.getPath("userData"), "meshlink.conf"),
  ];

  for (const configPath of configPaths) {
    try {
      const content = fs.readFileSync(configPath, "utf-8").trim();
      if (content) return content;
    } catch { /* not found, try next */ }
  }

  // Fallback: try loading built-in dist/index.html
  const distIndex = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(distIndex)) {
    return null; // Will load local file
  }

  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: "Meshlink",
    icon: path.join(__dirname, "public/icons/icon-256.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    backgroundColor: "#0a0a12",
  });

  const serverUrl = getServerUrl();

  if (serverUrl) {
    // Connect to remote server
    mainWindow.loadURL(serverUrl);
  } else if (!app.isPackaged) {
    // Dev mode
    mainWindow.loadURL("http://localhost:8080");
  } else {
    // Load built-in files
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  // Handle load failures
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // Aborted, ignore
    dialog.showErrorBox(
      "Connection Error",
      `Could not connect to Meshlink server.\n\n${errorDescription}\n\nMake sure the server is running and accessible.`
    );
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
