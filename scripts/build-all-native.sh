#!/bin/bash
# Build ALL native installers for Meshlink.
# Builds: Android Kotlin APK, Linux GTK4 binary, Windows EXE (Electron).
#
# Usage: sudo ./build-all-native.sh <server_url>
# Example: sudo ./build-all-native.sh https://72-56-244-207.nip.io

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_URL="${1:?Usage: $0 <server_url>}"
OUTPUT_DIR="$REPO_DIR/server/nginx/www/installers"

log() { echo "[BUILD] $1"; }
err() { echo "[BUILD] ERROR: $1" >&2; }

mkdir -p "$OUTPUT_DIR/native"

# ===== 1. Android Native (Kotlin) =====
log "=== Building Android Native APK ==="
ANDROID_DIR="$REPO_DIR/android-native"
if [ -d "$ANDROID_DIR" ]; then
    cd "$ANDROID_DIR"

    # Ensure SDK path
    ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
    export ANDROID_SDK_ROOT ANDROID_HOME="$ANDROID_SDK_ROOT"
    echo "sdk.dir=$ANDROID_SDK_ROOT" > local.properties

    # Ensure icons exist
    for d in mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi; do
        mkdir -p "app/src/main/res/$d"
        if [ ! -f "app/src/main/res/$d/ic_launcher.png" ]; then
            python3 -c "
import struct, zlib
def png(w,h,r,g,b):
    raw=b''
    for y in range(h):
        raw+=b'\x00'
        for x in range(w):
            cx,cy=x-w//2,y-h//2
            if cx*cx+cy*cy<(w//3)*(w//3): raw+=bytes([r,g,b,255])
            else: raw+=bytes([10,10,18,255])
    def chunk(t,d):
        c=t+d; return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
s={'mipmap-hdpi':48,'mipmap-xhdpi':72,'mipmap-xxhdpi':96}['$d']
with open('app/src/main/res/$d/ic_launcher.png','wb') as f: f.write(png(s,s,168,85,247))
" 2>/dev/null || true
        fi
    done

    # Ensure gradle wrapper
    if [ ! -f "gradlew" ]; then
        if [ -d "/opt/gradle" ]; then
            GRADLE_BIN=$(find /opt/gradle -name "gradle" -path "*/bin/*" | head -1)
            [ -n "$GRADLE_BIN" ] && "$GRADLE_BIN" wrapper --gradle-version 8.5 2>/dev/null
        fi
    fi

    if [ -f "gradlew" ]; then
        chmod +x gradlew
        ./gradlew assembleDebug 2>&1 | tail -5
        APK=$(find . -name "*.apk" -path "*/debug/*" | head -1)
        if [ -n "$APK" ] && [ -f "$APK" ]; then
            cp "$APK" "$OUTPUT_DIR/native/Meshlink-Android.apk"
            log "Android APK: $(du -h "$OUTPUT_DIR/native/Meshlink-Android.apk" | cut -f1)"
        else
            err "Android APK build failed"
        fi
    else
        err "No gradle wrapper — skipping Android native build"
    fi
else
    err "android-native/ not found"
fi

# ===== 2. Linux GTK4 Binary =====
log "=== Building Linux GTK4 Binary ==="
LINUX_DIR="$REPO_DIR/linux-native"
if [ -d "$LINUX_DIR" ]; then
    cd "$LINUX_DIR"

    # Install build deps if needed
    if ! pkg-config --exists gtk4 2>/dev/null; then
        log "Installing GTK4 build dependencies..."
        apt-get update -qq 2>/dev/null
        apt-get install -y -qq libgtk-4-dev libsoup-3.0-dev libjson-glib-dev \
            libsqlite3-dev libsecret-1-dev libssl-dev meson ninja-build 2>/dev/null || {
            err "Failed to install GTK4 deps — skipping Linux build"
            LINUX_DIR=""
        }
    fi

    if [ -n "$LINUX_DIR" ]; then
        # Build with meson
        rm -rf build
        meson setup build 2>&1 | tail -3 || { err "Meson setup failed"; LINUX_DIR=""; }

        if [ -n "$LINUX_DIR" ]; then
            ninja -C build 2>&1 | tail -5
            if [ -f "build/meshlink" ]; then
                cp build/meshlink "$OUTPUT_DIR/native/Meshlink-Linux"
                chmod +x "$OUTPUT_DIR/native/Meshlink-Linux"
                log "Linux binary: $(du -h "$OUTPUT_DIR/native/Meshlink-Linux" | cut -f1)"
            else
                err "Linux build failed"
            fi
        fi
    fi
else
    err "linux-native/ not found"
fi

# ===== 3. Windows EXE (Electron — already built by build-installers.sh) =====
log "=== Checking Windows EXE ==="
if [ -f "$OUTPUT_DIR/desktop/Meshlink-Setup-1.0.0.exe" ]; then
    cp "$OUTPUT_DIR/desktop/Meshlink-Setup-1.0.0.exe" "$OUTPUT_DIR/native/Meshlink-Windows.exe"
    log "Windows EXE: $(du -h "$OUTPUT_DIR/native/Meshlink-Windows.exe" | cut -f1)"
else
    log "Windows EXE not found — run build-installers.sh first"
fi

# ===== 4. WebView APK (already built by build-android.sh) =====
if [ -f "$OUTPUT_DIR/Meshlink.apk" ]; then
    log "WebView APK already exists: $(du -h "$OUTPUT_DIR/Meshlink.apk" | cut -f1)"
fi

# ===== Summary =====
log ""
log "=== Native Installers ==="
ls -lh "$OUTPUT_DIR/native/" 2>/dev/null || log "No native installers built"
log ""
log "Download URLs:"
for f in "$OUTPUT_DIR/native/"*; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    log "  ${SERVER_URL}/installers/native/${fname}"
done
