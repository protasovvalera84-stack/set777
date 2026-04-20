#!/bin/bash
# =============================================================================
# Generate platform installers from current server configuration.
# Reads SERVER_HOST and HTTP_PORT from .env and creates installer files.
#
# Usage: ./generate-installers.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SERVER_DIR/.env"
OUT_DIR="$SERVER_DIR/nginx/www/installers"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found. Run setup.sh first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

BASE_URL="http://${SERVER_HOST}"
if [ "${HTTP_PORT:-80}" != "80" ]; then
    BASE_URL="http://${SERVER_HOST}:${HTTP_PORT}"
fi

mkdir -p "$OUT_DIR"

echo "Generating installers for: $BASE_URL"

# --- Windows installer ---
cat > "$OUT_DIR/Meshlink-Install.bat" <<EOF
@echo off
title Meshlink Installer
color 0A
echo.
echo  ========================================
echo     Meshlink - Decentralized Messenger
echo  ========================================
echo.
echo  Installing Meshlink...

set "SERVER_URL=${BASE_URL}"

mkdir "%USERPROFILE%\Meshlink" 2>nul

echo @echo off > "%USERPROFILE%\Meshlink\Meshlink.bat"
echo start "" "%SERVER_URL%" >> "%USERPROFILE%\Meshlink\Meshlink.bat"

echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\ml_sc.vbs"
echo Set sc = ws.CreateShortcut(ws.SpecialFolders("Desktop") ^& "\Meshlink.lnk") >> "%TEMP%\ml_sc.vbs"
echo sc.TargetPath = "%USERPROFILE%\Meshlink\Meshlink.bat" >> "%TEMP%\ml_sc.vbs"
echo sc.IconLocation = "shell32.dll,14" >> "%TEMP%\ml_sc.vbs"
echo sc.Description = "Meshlink Messenger" >> "%TEMP%\ml_sc.vbs"
echo sc.WindowStyle = 7 >> "%TEMP%\ml_sc.vbs"
echo sc.Save >> "%TEMP%\ml_sc.vbs"
cscript //nologo "%TEMP%\ml_sc.vbs"
del "%TEMP%\ml_sc.vbs" 2>nul

mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Meshlink" 2>nul
echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\ml_sm.vbs"
echo Set sc = ws.CreateShortcut("%APPDATA%\Microsoft\Windows\Start Menu\Programs\Meshlink\Meshlink.lnk") >> "%TEMP%\ml_sm.vbs"
echo sc.TargetPath = "%USERPROFILE%\Meshlink\Meshlink.bat" >> "%TEMP%\ml_sm.vbs"
echo sc.IconLocation = "shell32.dll,14" >> "%TEMP%\ml_sm.vbs"
echo sc.Description = "Meshlink Messenger" >> "%TEMP%\ml_sm.vbs"
echo sc.Save >> "%TEMP%\ml_sm.vbs"
cscript //nologo "%TEMP%\ml_sm.vbs"
del "%TEMP%\ml_sm.vbs" 2>nul

echo.
echo  ========================================
echo   Done! Shortcut created on Desktop.
echo   Opening Meshlink now...
echo  ========================================

start "" "%SERVER_URL%"
exit
EOF

# --- Linux installer ---
cat > "$OUT_DIR/meshlink-install.sh" <<'LINEOF'
#!/bin/bash
# Meshlink Installer for Linux

SERVER_URL="__BASE_URL__"

echo ""
echo "========================================"
echo "   Meshlink - Decentralized Messenger"
echo "========================================"
echo ""
echo "Installing..."

mkdir -p "$HOME/Meshlink"

cat > "$HOME/Meshlink/meshlink" << 'LAUNCHER'
#!/bin/bash
xdg-open "__BASE_URL__" 2>/dev/null || sensible-browser "__BASE_URL__" 2>/dev/null || firefox "__BASE_URL__" 2>/dev/null || google-chrome "__BASE_URL__" 2>/dev/null
LAUNCHER
chmod +x "$HOME/Meshlink/meshlink"

mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/meshlink.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Name=Meshlink
Comment=Decentralized Encrypted Messenger
Exec=xdg-open __BASE_URL__
Icon=internet-chat
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
DESKTOP

DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
if [ -d "$DESKTOP_DIR" ]; then
    cp "$HOME/.local/share/applications/meshlink.desktop" "$DESKTOP_DIR/"
    chmod +x "$DESKTOP_DIR/meshlink.desktop" 2>/dev/null
    gio set "$DESKTOP_DIR/meshlink.desktop" metadata::trusted true 2>/dev/null
fi

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null

echo ""
echo "Done! Shortcut created on Desktop."
echo "Opening Meshlink now..."
echo ""

xdg-open "$SERVER_URL" 2>/dev/null || sensible-browser "$SERVER_URL" 2>/dev/null || echo "Open $SERVER_URL in your browser"
LINEOF

# Replace placeholder in Linux installer
sed -i "s|__BASE_URL__|${BASE_URL}|g" "$OUT_DIR/meshlink-install.sh"
chmod +x "$OUT_DIR/meshlink-install.sh"

# --- Android install page ---
cat > "$OUT_DIR/Meshlink-Android.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Install Meshlink - Android</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a12;color:#fff;padding:1.5rem}
    .card{max-width:420px;width:100%;text-align:center}
    .logo{width:80px;height:80px;border-radius:24px;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2rem;font-weight:700;color:#fff;box-shadow:0 0 40px rgba(168,85,247,0.3)}
    h1{font-size:2rem;margin-bottom:0.5rem;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#888;font-size:0.9rem;margin-bottom:2rem}
    .steps{text-align:left;background:rgba(255,255,255,0.05);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;border:1px solid rgba(255,255,255,0.1)}
    .step{display:flex;gap:12px;align-items:flex-start;margin-bottom:1rem}
    .step:last-child{margin-bottom:0}
    .num{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0}
    .step p{color:#ccc;font-size:0.9rem;line-height:1.5}
    .step b{color:#fff}
    .btn{display:block;width:100%;padding:1rem;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:16px;font-weight:600;font-size:1rem;border:none;cursor:pointer;box-shadow:0 0 30px rgba(168,85,247,0.3);transition:transform 0.2s;text-align:center}
    .btn:hover{transform:scale(1.02)}
    .note{margin-top:1.5rem;color:#555;font-size:0.75rem}
    .url{display:block;margin-top:1rem;padding:0.8rem;background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.1);color:#a855f7;font-family:monospace;font-size:0.85rem;word-break:break-all;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">M</div>
    <h1>Meshlink</h1>
    <p class="sub">Decentralized Encrypted Messenger</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><p>Open this link in <b>Chrome</b> on your Android device:</p></div>
      <div class="step"><div class="num">2</div><p>Tap the <b>menu &#8942;</b> (three dots in top right)</p></div>
      <div class="step"><div class="num">3</div><p>Select <b>"Install app"</b> or <b>"Add to Home screen"</b></p></div>
      <div class="step"><div class="num">4</div><p>Tap <b>Install</b> — the app icon appears on your home screen</p></div>
    </div>
    <a class="url" href="${BASE_URL}" target="_blank">${BASE_URL}</a>
    <a class="btn" href="${BASE_URL}" target="_blank" style="margin-top:1rem">Open in Browser</a>
    <p class="note">The app works offline after installation. No app store needed.</p>
  </div>
</body>
</html>
EOF

# --- iOS install page ---
cat > "$OUT_DIR/Meshlink-iOS.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Install Meshlink - iOS</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a12;color:#fff;padding:1.5rem}
    .card{max-width:420px;width:100%;text-align:center}
    .logo{width:80px;height:80px;border-radius:24px;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2rem;font-weight:700;color:#fff;box-shadow:0 0 40px rgba(168,85,247,0.3)}
    h1{font-size:2rem;margin-bottom:0.5rem;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#888;font-size:0.9rem;margin-bottom:2rem}
    .steps{text-align:left;background:rgba(255,255,255,0.05);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;border:1px solid rgba(255,255,255,0.1)}
    .step{display:flex;gap:12px;align-items:flex-start;margin-bottom:1rem}
    .step:last-child{margin-bottom:0}
    .num{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0}
    .step p{color:#ccc;font-size:0.9rem;line-height:1.5}
    .step b{color:#fff}
    .btn{display:block;width:100%;padding:1rem;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:16px;font-weight:600;font-size:1rem;border:none;cursor:pointer;box-shadow:0 0 30px rgba(168,85,247,0.3);transition:transform 0.2s;text-align:center}
    .btn:hover{transform:scale(1.02)}
    .note{margin-top:1.5rem;color:#555;font-size:0.75rem}
    .url{display:block;margin-top:1rem;padding:0.8rem;background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.1);color:#a855f7;font-family:monospace;font-size:0.85rem;word-break:break-all;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">M</div>
    <h1>Meshlink</h1>
    <p class="sub">Decentralized Encrypted Messenger</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><p>Open this link in <b>Safari</b> on your iPhone/iPad:</p></div>
      <div class="step"><div class="num">2</div><p>Tap the <b>Share button</b> &#8593; at the bottom of Safari</p></div>
      <div class="step"><div class="num">3</div><p>Scroll down and tap <b>"Add to Home Screen"</b></p></div>
      <div class="step"><div class="num">4</div><p>Tap <b>Add</b> — the app icon appears on your home screen</p></div>
    </div>
    <a class="url" href="${BASE_URL}" target="_blank">${BASE_URL}</a>
    <a class="btn" href="${BASE_URL}" target="_blank" style="margin-top:1rem">Open in Safari</a>
    <p class="note">The app works offline after installation. No App Store needed.</p>
  </div>
</body>
</html>
EOF

echo "Installers generated in: $OUT_DIR"
echo "  - Meshlink-Install.bat (Windows)"
echo "  - meshlink-install.sh (Linux)"
echo "  - Meshlink-Android.html (Android PWA)"
echo "  - Meshlink-iOS.html (iOS PWA)"
