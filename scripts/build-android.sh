#!/bin/bash
# Meshlink Android APK Builder
# Creates a WebView Android app that loads the Meshlink server URL.
# No Capacitor CLI needed — generates Android project directly.
#
# Usage: sudo ./build-android.sh <server_url>
# Example: sudo ./build-android.sh https://72-56-244-207.nip.io

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_URL="${1:?Usage: $0 <server_url>}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
OUTPUT_DIR="$REPO_DIR/server/nginx/www/meshlink/installers"
ANDROID_DIR="$REPO_DIR/android-build"

log() { echo "[ANDROID] $1"; }
err() { echo "[ANDROID] ERROR: $1" >&2; }

# ===== Step 1: Install dependencies =====
log "Checking dependencies..."
apt-get update -qq 2>/dev/null
for pkg in openjdk-17-jdk-headless unzip wget; do
    dpkg -s "$pkg" &>/dev/null || apt-get install -y -qq "$pkg" 2>/dev/null
done
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="$JAVA_HOME/bin:$PATH"
log "Java: $(java -version 2>&1 | head -1)"

# ===== Step 2: Install Android SDK =====
if [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin" ]; then
    log "Installing Android SDK..."
    mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
    wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O /tmp/sdk.zip
    unzip -q -o /tmp/sdk.zip -d /tmp/sdk-extract
    rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    mv /tmp/sdk-extract/cmdline-tools "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    rm -f /tmp/sdk.zip && rm -rf /tmp/sdk-extract
fi
export ANDROID_SDK_ROOT ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

log "Installing SDK packages..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools" 2>/dev/null | grep -v "^$" | tail -3

# ===== Step 3: Create Android project from scratch =====
log "Creating Android project..."
rm -rf "$ANDROID_DIR"
mkdir -p "$ANDROID_DIR/app/src/main/java/io/meshlink/app"
mkdir -p "$ANDROID_DIR/app/src/main/res/values"
mkdir -p "$ANDROID_DIR/app/src/main/res/xml"
mkdir -p "$ANDROID_DIR/app/src/main/res/mipmap-hdpi"
mkdir -p "$ANDROID_DIR/app/src/main/res/mipmap-xhdpi"
mkdir -p "$ANDROID_DIR/app/src/main/res/mipmap-xxhdpi"

# --- settings.gradle ---
cat > "$ANDROID_DIR/settings.gradle" << 'EOF'
rootProject.name = "Meshlink"
include ':app'
EOF

# --- build.gradle (root) ---
cat > "$ANDROID_DIR/build.gradle" << 'EOF'
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
EOF

# --- app/build.gradle ---
cat > "$ANDROID_DIR/app/build.gradle" << 'EOF'
apply plugin: 'com.android.application'

android {
    namespace 'io.meshlink.app'
    compileSdk 34

    defaultConfig {
        applicationId "io.meshlink.app"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        debug {
            minifyEnabled false
        }
        release {
            minifyEnabled false
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.9.0'
}
EOF

# --- gradle.properties ---
cat > "$ANDROID_DIR/gradle.properties" << 'EOF'
android.useAndroidX=true
org.gradle.jvmargs=-Xmx2048m
EOF

# --- local.properties ---
echo "sdk.dir=$ANDROID_SDK_ROOT" > "$ANDROID_DIR/local.properties"

# --- gradle wrapper ---
mkdir -p "$ANDROID_DIR/gradle/wrapper"
cat > "$ANDROID_DIR/gradle/wrapper/gradle-wrapper.properties" << 'EOF'
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-bin.zip
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

# Create gradlew
cd "$ANDROID_DIR"
if [ ! -f "gradlew" ]; then
    # Download gradle wrapper jar
    GRADLE_WRAPPER_URL="https://raw.githubusercontent.com/nicoulaj/gradle-wrapper/refs/heads/master/gradle/wrapper/gradle-wrapper.jar"
    wget -q "https://github.com/nicoulaj/gradle-wrapper/raw/master/gradle/wrapper/gradle-wrapper.jar" -O gradle/wrapper/gradle-wrapper.jar 2>/dev/null || {
        # Fallback: install gradle and generate wrapper
        if [ ! -d "/opt/gradle/gradle-8.5" ]; then
            wget -q "https://services.gradle.org/distributions/gradle-8.5-bin.zip" -O /tmp/gradle.zip
            mkdir -p /opt/gradle && unzip -q -o /tmp/gradle.zip -d /opt/gradle && rm -f /tmp/gradle.zip
        fi
        /opt/gradle/gradle-8.5/bin/gradle wrapper --gradle-version 8.5 2>/dev/null
    }
fi

# --- AndroidManifest.xml ---
cat > "$ANDROID_DIR/app/src/main/AndroidManifest.xml" << MANIFEST
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Meshlink"
        android:theme="@style/AppTheme"
        android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="false">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
MANIFEST

# --- MainActivity.java ---
cat > "$ANDROID_DIR/app/src/main/java/io/meshlink/app/MainActivity.java" << JAVAEOF
package io.meshlink.app;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.net.Uri;
import android.content.Intent;
import android.os.Build;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String SERVER_URL = "${SERVER_URL}";
    private ValueCallback<Uri[]> fileUploadCallback;
    private static final int FILE_CHOOSER_REQUEST = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Status bar color
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF0A0A12);
        }

        webView = new WebView(this);
        setContentView(webView);

        // WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " MeshlinkAndroid/1.0");

        // Enable cookies
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Handle navigation
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(SERVER_URL)) {
                    return false; // Load in WebView
                }
                // External link — open in browser
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            }
        });

        // Handle permissions (camera, microphone)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                fileUploadCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl(SERVER_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && fileUploadCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }
}
JAVAEOF

# --- styles.xml ---
cat > "$ANDROID_DIR/app/src/main/res/values/styles.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">#0A0A12</item>
        <item name="android:statusBarColor">#0A0A12</item>
        <item name="android:navigationBarColor">#0A0A12</item>
    </style>
</resources>
EOF

# --- network_security_config.xml ---
cat > "$ANDROID_DIR/app/src/main/res/xml/network_security_config.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
EOF

# --- App icon (simple purple circle) ---
# Generate a minimal PNG icon using Python
python3 -c "
import struct, zlib
def png(w,h,r,g,b):
    raw=b''
    for y in range(h):
        raw+=b'\x00'
        for x in range(w):
            cx,cy=x-w//2,y-h//2
            if cx*cx+cy*cy<(w//3)*(w//3):
                raw+=bytes([r,g,b,255])
            else:
                raw+=bytes([10,10,18,255])
    def chunk(t,d):
        c=t+d
        return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
for s,d in [(48,'mipmap-hdpi'),(72,'mipmap-xhdpi'),(96,'mipmap-xxhdpi')]:
    with open(f'app/src/main/res/{d}/ic_launcher.png','wb') as f:
        f.write(png(s,s,168,85,247))
" 2>/dev/null || log "Icon generation skipped (non-critical)"

# ===== Step 4: Build APK =====
log "Building APK..."
cd "$ANDROID_DIR"

# Use gradle wrapper or system gradle
if [ -f "gradlew" ] && [ -f "gradle/wrapper/gradle-wrapper.jar" ]; then
    chmod +x gradlew
    ./gradlew assembleDebug 2>&1 | tail -5
else
    # Use system gradle
    GRADLE_BIN=""
    if command -v gradle &>/dev/null; then
        GRADLE_BIN="gradle"
    elif [ -d "/opt/gradle" ]; then
        GRADLE_BIN=$(find /opt/gradle -name "gradle" -path "*/bin/*" | head -1)
    fi
    if [ -z "$GRADLE_BIN" ]; then
        log "Installing Gradle..."
        wget -q "https://services.gradle.org/distributions/gradle-8.5-bin.zip" -O /tmp/gradle.zip
        mkdir -p /opt/gradle && unzip -q -o /tmp/gradle.zip -d /opt/gradle && rm -f /tmp/gradle.zip
        GRADLE_BIN="/opt/gradle/gradle-8.5/bin/gradle"
    fi
    # Generate wrapper first
    "$GRADLE_BIN" wrapper --gradle-version 8.5 2>/dev/null
    chmod +x gradlew
    ./gradlew assembleDebug 2>&1 | tail -5
fi

# ===== Step 5: Copy APK to output =====
APK_PATH=$(find . -name "*.apk" -path "*/debug/*" 2>/dev/null | head -1)
if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
    mkdir -p "$OUTPUT_DIR"
    cp "$APK_PATH" "$OUTPUT_DIR/Meshlink.apk"
    chmod 644 "$OUTPUT_DIR/Meshlink.apk"
    APK_SIZE=$(du -h "$OUTPUT_DIR/Meshlink.apk" | cut -f1)
    log ""
    log "=== Android APK Built Successfully ==="
    log "  File: $OUTPUT_DIR/Meshlink.apk ($APK_SIZE)"
    log "  URL:  ${SERVER_URL}/installers/Meshlink.apk"
    log ""
else
    err "APK build failed."
    log "Trying to find any APK..."
    find . -name "*.apk" 2>/dev/null
    exit 1
fi
