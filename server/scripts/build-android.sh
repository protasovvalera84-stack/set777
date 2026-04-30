#!/bin/bash
# =============================================================================
# Build Meshlink Android APK
# Requires: Java 17+, Node.js 18+
# Installs Android SDK automatically if not present
# Output: server/nginx/www/installers/Meshlink.apk
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$SERVER_DIR/nginx/www/installers"
ANDROID_SDK_DIR="$HOME/.android-sdk"

echo "=== Meshlink Android APK Builder ==="

# Check Java
if ! command -v java &>/dev/null; then
    echo "Installing Java..."
    apt-get update -qq && apt-get install -y -qq openjdk-17-jdk-headless >/dev/null 2>&1
fi

echo "Java: $(java -version 2>&1 | head -1)"

# Install Android SDK if not present
if [ ! -d "$ANDROID_SDK_DIR/platforms/android-34" ]; then
    echo "Installing Android SDK..."
    mkdir -p "$ANDROID_SDK_DIR"
    
    if [ ! -f "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
        cd /tmp
        curl -sL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o cmdtools.zip
        unzip -q -o cmdtools.zip
        mkdir -p "$ANDROID_SDK_DIR/cmdline-tools/latest"
        cp -r cmdline-tools/* "$ANDROID_SDK_DIR/cmdline-tools/latest/" 2>/dev/null || true
        rm -rf cmdtools.zip cmdline-tools
    fi
    
    yes | "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" \
        --sdk_root="$ANDROID_SDK_DIR" \
        "platforms;android-34" "build-tools;34.0.0" 2>/dev/null || true
    
    echo "Android SDK installed."
fi

# Build web app
echo "Building web app..."
cd "$PROJECT_DIR"
npm install --silent 2>/dev/null
npm run build

# Sync Capacitor
echo "Syncing Capacitor..."
npx cap sync android

# Set SDK path
echo "sdk.dir=$ANDROID_SDK_DIR" > "$PROJECT_DIR/android/local.properties"

# Build APK
echo "Building APK..."
cd "$PROJECT_DIR/android"
export ANDROID_HOME="$ANDROID_SDK_DIR"
chmod +x gradlew
./gradlew assembleDebug --no-daemon -q 2>/dev/null

# Copy APK to installers directory
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    mkdir -p "$OUT_DIR"
    cp "$APK_PATH" "$OUT_DIR/Meshlink.apk"
    echo ""
    echo "=== APK Built Successfully ==="
    echo "Location: $OUT_DIR/Meshlink.apk"
    echo "Size: $(du -h "$OUT_DIR/Meshlink.apk" | cut -f1)"
    echo ""
else
    echo "WARNING: APK build failed. The APK will be available after running on a machine with proper Android SDK."
    echo "You can build manually: cd $(pwd) && ./gradlew assembleDebug"
fi
