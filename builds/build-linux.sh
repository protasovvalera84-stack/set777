#!/bin/bash
# ============================================
# Meshlink — Linux Desktop Build Script
# ============================================
# Creates a standalone Linux desktop app using Electron.
# Result: builds/meshlink-linux.AppImage
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/builds"
ELECTRON_DIR="$PROJECT_DIR/electron-build"

echo "========================================="
echo "   Meshlink Linux Desktop Builder"
echo "========================================="

# Build web
cd "$PROJECT_DIR"
echo "[*] Installing dependencies..."
npm install --silent
echo "[*] Building web..."
npm run build

# Create Electron app
echo "[*] Setting up Electron..."
rm -rf "$ELECTRON_DIR"
mkdir -p "$ELECTRON_DIR"

# Package.json for Electron
cat > "$ELECTRON_DIR/package.json" << 'EOF'
{
  "name": "meshlink-desktop",
  "version": "1.0.0",
  "description": "Meshlink - Encrypted Messenger",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --linux AppImage"
  },
  "build": {
    "appId": "app.meshlink.desktop",
    "productName": "Meshlink",
    "linux": {
      "target": "AppImage",
      "category": "Network"
    },
    "files": ["main.js", "preload.js", "web/**/*"]
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
EOF

# Main process
cat > "$ELECTRON_DIR/main.js" << 'EOF'
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'Meshlink',
    icon: path.join(__dirname, 'web/icons/icon-256.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'web/index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
EOF

# Preload
cat > "$ELECTRON_DIR/preload.js" << 'EOF'
// Preload script — secure bridge between web and native
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('meshlink', { platform: 'desktop' });
EOF

# Copy web build
cp -r "$PROJECT_DIR/dist" "$ELECTRON_DIR/web"

# Install and build
cd "$ELECTRON_DIR"
echo "[*] Installing Electron..."
npm install --silent 2>/dev/null
echo "[*] Building Linux app..."
npx electron-builder --linux AppImage 2>/dev/null

# Copy result
mkdir -p "$BUILD_DIR"
APPIMAGE=$(find dist -name "*.AppImage" | head -1)
if [ -n "$APPIMAGE" ]; then
    cp "$APPIMAGE" "$BUILD_DIR/meshlink-linux.AppImage"
    chmod +x "$BUILD_DIR/meshlink-linux.AppImage"
    echo ""
    echo "========================================="
    echo "   ✓ Linux app built successfully!"
    echo "   Location: builds/meshlink-linux.AppImage"
    echo "   Size: $(du -h "$BUILD_DIR/meshlink-linux.AppImage" | cut -f1)"
    echo "========================================="
else
    echo "[!] Build failed. Check errors above."
    exit 1
fi

# Cleanup
rm -rf "$ELECTRON_DIR"
