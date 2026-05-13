#!/bin/bash
# Meshlink Android APK Builder
# Builds Android APK using Capacitor + Android SDK (headless, no Android Studio)
#
# Usage: ./build-android.sh <server_url>
# Example: ./build-android.sh https://72-56-244-207.nip.io
#
# Installs Android SDK, Gradle, Java if not present.
# Outputs APK to server/nginx/www/meshlink/installers/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_URL="${1:?Usage: $0 <server_url>}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
OUTPUT_DIR="$REPO_DIR/server/nginx/www/meshlink/installers"

log() { echo "[ANDROID] $1"; }
err() { echo "[ANDROID] ERROR: $1" >&2; }

# ===== Step 1: Install Java (OpenJDK 17) =====
if ! command -v javac &>/dev/null; then
    log "Installing Java 17..."
    apt-get update -qq && apt-get install -y -qq openjdk-17-jdk-headless unzip wget 2>/dev/null
fi
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac))))
log "Java: $(javac -version 2>&1)"

# ===== Step 2: Install Android SDK command-line tools =====
if [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin" ]; then
    log "Installing Android SDK command-line tools..."
    mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
    cd /tmp
    CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    wget -q "$CMDLINE_URL" -O cmdline-tools.zip
    unzip -q -o cmdline-tools.zip -d /tmp/cmdline-extract
    mv /tmp/cmdline-extract/cmdline-tools "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    rm -f cmdline-tools.zip
    rm -rf /tmp/cmdline-extract
fi
export ANDROID_SDK_ROOT
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
log "SDK Manager: $(sdkmanager --version 2>/dev/null || echo 'installed')"

# ===== Step 3: Install required SDK packages =====
log "Installing Android SDK packages (this may take a few minutes)..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager --install \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "platform-tools" \
    2>/dev/null | tail -3

# ===== Step 4: Install Gradle =====
if ! command -v gradle &>/dev/null; then
    GRADLE_VER="8.7"
    if [ ! -d "/opt/gradle/gradle-${GRADLE_VER}" ]; then
        log "Installing Gradle ${GRADLE_VER}..."
        wget -q "https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip" -O /tmp/gradle.zip
        mkdir -p /opt/gradle
        unzip -q -o /tmp/gradle.zip -d /opt/gradle
        rm -f /tmp/gradle.zip
    fi
    export PATH="/opt/gradle/gradle-${GRADLE_VER}/bin:$PATH"
fi
log "Gradle: $(gradle --version 2>/dev/null | head -1 || echo 'installed')"

# ===== Step 5: Setup Capacitor project =====
log "Setting up Capacitor Android project..."
cd "$REPO_DIR"

# Install Capacitor if not present
if ! grep -q "@capacitor/core" package.json 2>/dev/null; then
    npm install @capacitor/core @capacitor/cli @capacitor/android --save 2>/dev/null | tail -2
fi

# Create capacitor config
cat > capacitor.config.json << CAPEOF
{
  "appId": "io.meshlink.app",
  "appName": "Meshlink",
  "webDir": "dist",
  "server": {
    "url": "${SERVER_URL}",
    "cleartext": false
  },
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": false
  }
}
CAPEOF

# Build web app if not built
if [ ! -d "dist" ]; then
    log "Building web app..."
    npm run build
fi

# Add Android platform
if [ ! -d "android" ]; then
    log "Adding Android platform..."
    npx cap add android 2>/dev/null || true
fi

# Sync web assets to Android
log "Syncing web assets..."
npx cap sync android 2>/dev/null | tail -3

# ===== Step 6: Configure Android project =====
# Set SDK path
echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties

# Fix network security for HTTPS
mkdir -p android/app/src/main/res/xml
cat > android/app/src/main/res/xml/network_security_config.xml << NETEOF
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">nip.io</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
</network-security-config>
NETEOF

# ===== Step 7: Build APK =====
log "Building APK (this takes 2-5 minutes)..."
cd android
chmod +x gradlew 2>/dev/null || true

# Build debug APK (no signing needed)
./gradlew assembleDebug 2>&1 | tail -10

# Find the APK
APK_PATH=$(find . -name "*.apk" -path "*/debug/*" | head -1)
if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
    mkdir -p "$OUTPUT_DIR"
    cp "$APK_PATH" "$OUTPUT_DIR/Meshlink.apk"
    APK_SIZE=$(du -h "$OUTPUT_DIR/Meshlink.apk" | cut -f1)
    log ""
    log "=== Android APK Built ==="
    log "  File: $OUTPUT_DIR/Meshlink.apk ($APK_SIZE)"
    log "  URL:  ${SERVER_URL}/installers/Meshlink.apk"
    log ""
else
    err "APK build failed. Check gradle output above."
    exit 1
fi
