# Meshlink — Build Instructions

## Quick Build Commands

### Android APK
```bash
chmod +x builds/build-android.sh
./builds/build-android.sh
# Result: builds/meshlink.apk
```

### Linux Desktop (AppImage)
```bash
chmod +x builds/build-linux.sh
./builds/build-linux.sh
# Result: builds/meshlink-linux.AppImage
```

### Windows Desktop (Installer)
```cmd
builds\build-windows.bat
# Result: builds\meshlink-windows.exe
```

---

## Requirements

### Android
- Ubuntu/Debian Linux
- Node.js 18+
- Java 17+ (auto-installed)
- Android SDK (auto-installed)
- ~5 GB disk space

### Linux Desktop
- Node.js 18+
- npm
- ~2 GB disk space

### Windows Desktop
- Windows 10/11
- Node.js 18+ (https://nodejs.org)
- ~2 GB disk space

---

## Manual Build (if scripts fail)

### Android
```bash
npm install && npm run build
npx cap sync android
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Desktop (any OS)
```bash
npm install && npm run build
mkdir electron-app && cd electron-app
# Copy package.json, main.js, preload.js from builds/build-linux.sh
cp -r ../dist web/
npm install
npx electron-builder --linux   # or --win or --mac
```

---

## Output Files

| Platform | File | Size |
|----------|------|------|
| Android | `builds/meshlink.apk` | ~15 MB |
| Linux | `builds/meshlink-linux.AppImage` | ~80 MB |
| Windows | `builds/meshlink-windows.exe` | ~80 MB |

---

## Install on Device

### Android
1. Copy `meshlink.apk` to phone
2. Open file manager → tap APK
3. Allow "Install from unknown sources"
4. Install → Open

### Linux
1. `chmod +x meshlink-linux.AppImage`
2. `./meshlink-linux.AppImage`

### Windows
1. Double-click `meshlink-windows.exe`
2. Follow installer
3. Launch from Start Menu
