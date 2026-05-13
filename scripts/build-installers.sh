#!/bin/bash
# Meshlink Desktop Installer Builder
# Builds Windows EXE and Linux AppImage from the Electron wrapper
#
# Usage: ./build-installers.sh <server_url>
# Example: ./build-installers.sh https://72-56-244-207.nip.io
#
# Requires: Node.js, npm, Docker (for Windows cross-compilation)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR/../desktop"
OUTPUT_DIR="$SCRIPT_DIR/../server/nginx/www/meshlink/installers/desktop"
SERVER_URL="${1:?Usage: $0 <server_url>}"

log() { echo "[INSTALLER] $1"; }
err() { echo "[INSTALLER] ERROR: $1" >&2; }

# Validate
if [ ! -f "$DESKTOP_DIR/package.json" ]; then
    err "desktop/package.json not found"
    exit 1
fi

log "Building Meshlink installers for: $SERVER_URL"

# Inject server URL into main.js
log "Configuring server URL..."
sed -i "s|__MESHLINK_SERVER_URL__|${SERVER_URL}|g" "$DESKTOP_DIR/main.js"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Install dependencies
log "Installing Electron dependencies..."
cd "$DESKTOP_DIR"
npm install --no-audit --no-fund 2>&1 | tail -3

# Build Linux AppImage (native, no Docker needed)
log "Building Linux AppImage..."
npx electron-builder --linux AppImage --x64 \
    --config.directories.output="$OUTPUT_DIR" 2>&1 | tail -5

if ls "$OUTPUT_DIR"/*.AppImage 1>/dev/null 2>&1; then
    log "Linux AppImage built: $(ls "$OUTPUT_DIR"/*.AppImage)"
else
    err "Linux AppImage build failed"
fi

# Build Windows EXE
# Try Docker first (cleanest), fall back to Wine
if command -v docker &>/dev/null; then
    log "Building Windows EXE via Docker (electron-builder:wine)..."
    docker run --rm \
        -v "$DESKTOP_DIR":/project \
        -v "$OUTPUT_DIR":/output \
        -w /project \
        electronuserland/builder:wine \
        /bin/bash -c "npm install --no-audit --no-fund && npx electron-builder --win nsis --x64 --config.directories.output=/output" 2>&1 | tail -10

    if ls "$OUTPUT_DIR"/*.exe 1>/dev/null 2>&1; then
        log "Windows EXE built: $(ls "$OUTPUT_DIR"/*.exe)"
    else
        err "Windows EXE build failed via Docker"
    fi
elif command -v wine &>/dev/null; then
    log "Building Windows EXE via Wine..."
    npx electron-builder --win nsis --x64 \
        --config.directories.output="$OUTPUT_DIR" 2>&1 | tail -5

    if ls "$OUTPUT_DIR"/*.exe 1>/dev/null 2>&1; then
        log "Windows EXE built: $(ls "$OUTPUT_DIR"/*.exe)"
    else
        err "Windows EXE build failed via Wine"
    fi
else
    log "Docker and Wine not available — skipping Windows EXE build"
    log "Install Docker to enable Windows builds: curl -fsSL https://get.docker.com | sh"
fi

# Restore main.js template (so git stays clean)
sed -i "s|${SERVER_URL}|__MESHLINK_SERVER_URL__|g" "$DESKTOP_DIR/main.js"

# Summary
log ""
log "=== Build Complete ==="
ls -lh "$OUTPUT_DIR"/*.exe "$OUTPUT_DIR"/*.AppImage 2>/dev/null || log "No installers built"
log ""
log "Download URLs:"
for f in "$OUTPUT_DIR"/*; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    # Skip non-installer files
    case "$fname" in *.exe|*.AppImage|*.deb) log "  ${SERVER_URL}/installers/desktop/${fname}" ;; esac
done
