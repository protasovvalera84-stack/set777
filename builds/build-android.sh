#!/bin/bash
# ============================================
# Meshlink — Android APK Build Script
# ============================================
# Run this on Ubuntu/Debian with internet access.
# Result: builds/meshlink.apk
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/builds"

echo "========================================="
echo "   Meshlink Android APK Builder"
echo "========================================="

# Check Java
if ! command -v java &>/dev/null; then
    echo "[!] Java not found. Installing..."
    sudo apt update && sudo apt install -y openjdk-17-jdk
fi

# Check/Install Android SDK
ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
if [ ! -d "$ANDROID_HOME/platforms/android-34" ]; then
    echo "[*] Installing Android SDK..."
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    cd /tmp
    wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O cmdtools.zip
    unzip -qo cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"
    mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" 2>/dev/null || true
    export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
    yes | sdkmanager --licenses >/dev/null 2>&1
    sdkmanager "platforms;android-34" "build-tools;34.0.0" >/dev/null 2>&1
    echo "[✓] Android SDK installed"
fi

export ANDROID_HOME
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# Build web
cd "$PROJECT_DIR"
echo "[*] Installing dependencies..."
npm install --silent
echo "[*] Building web..."
npm run build

# Sync Capacitor
echo "[*] Syncing Capacitor..."
npx cap sync android

# Build APK
cd "$PROJECT_DIR/android"
echo "sdk.dir=$ANDROID_HOME" > local.properties
chmod +x gradlew
echo "[*] Building APK (this may take a few minutes)..."
./gradlew assembleRelease --quiet 2>/dev/null || ./gradlew assembleDebug --quiet

# Copy APK
mkdir -p "$BUILD_DIR"
APK_PATH=$(find app/build/outputs/apk -name "*.apk" | head -1)
if [ -n "$APK_PATH" ]; then
    cp "$APK_PATH" "$BUILD_DIR/meshlink.apk"
    echo ""
    echo "========================================="
    echo "   ✓ APK built successfully!"
    echo "   Location: builds/meshlink.apk"
    echo "   Size: $(du -h "$BUILD_DIR/meshlink.apk" | cut -f1)"
    echo "========================================="
else
    echo "[!] APK build failed. Check errors above."
    exit 1
fi
