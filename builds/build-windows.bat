@echo off
REM ============================================
REM Meshlink — Windows Desktop Build Script
REM ============================================
REM Creates a standalone Windows desktop app using Electron.
REM Result: builds\meshlink-windows.exe
REM ============================================

echo =========================================
echo    Meshlink Windows Desktop Builder
echo =========================================

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Download from https://nodejs.org
    exit /b 1
)

REM Build web
cd /d "%~dp0.."
echo [*] Installing dependencies...
call npm install --silent
echo [*] Building web...
call npm run build

REM Create Electron app
echo [*] Setting up Electron...
if exist electron-build rmdir /s /q electron-build
mkdir electron-build

REM Package.json
(
echo {
echo   "name": "meshlink-desktop",
echo   "version": "1.0.0",
echo   "description": "Meshlink - Encrypted Messenger",
echo   "main": "main.js",
echo   "scripts": {
echo     "start": "electron .",
echo     "build": "electron-builder --win nsis"
echo   },
echo   "build": {
echo     "appId": "app.meshlink.desktop",
echo     "productName": "Meshlink",
echo     "win": {
echo       "target": "nsis",
echo       "icon": "web/icons/icon-256.png"
echo     },
echo     "nsis": {
echo       "oneClick": true,
echo       "allowToChangeInstallationDirectory": false
echo     },
echo     "files": ["main.js", "preload.js", "web/**/*"]
echo   },
echo   "devDependencies": {
echo     "electron": "^33.0.0",
echo     "electron-builder": "^25.0.0"
echo   }
echo }
) > electron-build\package.json

REM Main process
(
echo const { app, BrowserWindow, shell } = require('electron'^);
echo const path = require('path'^);
echo let mainWindow;
echo function createWindow(^) {
echo   mainWindow = new BrowserWindow({
echo     width: 1200, height: 800, minWidth: 400, minHeight: 600,
echo     title: 'Meshlink',
echo     webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js'^) }
echo   }^);
echo   mainWindow.loadFile(path.join(__dirname, 'web/index.html'^)^);
echo   mainWindow.setMenuBarVisibility(false^);
echo   mainWindow.webContents.setWindowOpenHandler(({ url }^) =^> { shell.openExternal(url^); return { action: 'deny' }; }^);
echo }
echo app.whenReady(^).then(createWindow^);
echo app.on('window-all-closed', (^) =^> { app.quit(^); }^);
) > electron-build\main.js

REM Preload
(
echo const { contextBridge } = require('electron'^);
echo contextBridge.exposeInMainWorld('meshlink', { platform: 'desktop' }^);
) > electron-build\preload.js

REM Copy web build
xcopy /s /e /q dist electron-build\web\

REM Install and build
cd electron-build
echo [*] Installing Electron...
call npm install --silent
echo [*] Building Windows installer...
call npx electron-builder --win nsis

REM Copy result
if not exist ..\builds mkdir ..\builds
for /r dist %%f in (*.exe) do (
    copy "%%f" "..\builds\meshlink-windows.exe" >nul
    echo.
    echo =========================================
    echo    SUCCESS: builds\meshlink-windows.exe
    echo =========================================
    goto :done
)
echo [!] Build failed.
:done
cd ..
rmdir /s /q electron-build
