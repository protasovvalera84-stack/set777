package io.meshlink.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import io.meshlink.app.BuildConfig
import io.meshlink.app.R

/**
 * Full-featured WebView Activity — loads web UI with ALL native capabilities.
 *
 * Supports:
 * - WebRTC (voice/video calls, screen share)
 * - File upload (camera, gallery, documents)
 * - File download (APK, media, documents)
 * - Push notifications
 * - Service Worker (offline support)
 * - Clipboard API
 * - Vibration API
 * - Geolocation
 * - LocalStorage / IndexedDB
 * - Audio/Video playback
 * - Camera/Microphone access
 */
class WebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val serverUrl = BuildConfig.SERVER_URL
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_webview)

        // Request permissions upfront
        requestPermissions()

        // Create notification channel
        createNotificationChannel()

        webView = findViewById(R.id.webView)
        configureWebView()

        // Load web app
        webView.loadUrl(serverUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            // Core
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            // Cache & offline
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true

            // Media
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // Display
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
            setSupportZoom(false)
            setSupportMultipleWindows(false)

            // Service Worker support
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        // Enable WebRTC
        webView.setWebChromeClient(MeshlinkChromeClient())
        webView.setWebViewClient(MeshlinkWebClient())

        // File downloads
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            downloadFile(url, userAgent, contentDisposition, mimeType)
        }

        // JavaScript → Kotlin bridge
        webView.addJavascriptInterface(NativeBridge(), "MeshlinkNative")
    }

    // ===== WebChromeClient — handles permissions, file upload, WebRTC =====
    inner class MeshlinkChromeClient : WebChromeClient() {

        // File upload (camera, gallery, documents)
        override fun onShowFileChooser(
            webView: WebView?,
            callback: ValueCallback<Array<Uri>>?,
            params: FileChooserParams?
        ): Boolean {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = callback
            try {
                val intent = params?.createIntent() ?: return false
                startActivityForResult(intent, FILE_CHOOSER_REQUEST)
            } catch (e: Exception) {
                fileUploadCallback = null
                Toast.makeText(this@WebViewActivity, "Cannot open file chooser", Toast.LENGTH_SHORT).show()
                return false
            }
            return true
        }

        // WebRTC — camera/microphone permissions
        override fun onPermissionRequest(request: PermissionRequest?) {
            runOnUiThread {
                request?.grant(request.resources)
            }
        }

        // Geolocation
        override fun onGeolocationPermissionsShowPrompt(
            origin: String?,
            callback: GeolocationPermissions.Callback?
        ) {
            callback?.invoke(origin, true, false)
        }

        // Console log (for debugging)
        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
            return true // Suppress console logs in production
        }
    }

    // ===== WebViewClient — handles navigation, errors, SSL =====
    inner class MeshlinkWebClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return false

            // Keep all server URLs inside WebView
            if (url.startsWith(serverUrl) || url.contains("/_matrix/")) {
                return false
            }

            // tel: links
            if (url.startsWith("tel:")) {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(url)))
                return true
            }

            // mailto: links
            if (url.startsWith("mailto:")) {
                startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse(url)))
                return true
            }

            // External links → browser
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            return true
        }

        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
            super.onReceivedError(view, request, error)
            if (request?.isForMainFrame == true) {
                showOfflinePage(view)
            }
        }

        override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
            // Accept self-signed certs for development
            handler?.proceed()
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            // Inject native detection script
            view?.evaluateJavascript("""
                (function() {
                    window.__MESHLINK_NATIVE = true;
                    window.__MESHLINK_PLATFORM = 'android';
                    window.__MESHLINK_VERSION = '${BuildConfig.VERSION_NAME}';
                    // Hide PWA install banner in native app
                    var style = document.createElement('style');
                    style.textContent = '[data-pwa-banner] { display: none !important; }';
                    document.head.appendChild(style);
                })();
            """.trimIndent(), null)
        }
    }

    // ===== File download handler =====
    private fun downloadFile(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        try {
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                setTitle(fileName)
                setDescription("Downloading $fileName")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }
            val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Downloading: $fileName", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // ===== Offline page =====
    private fun showOfflinePage(view: WebView?) {
        view?.loadData("""
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
                body { background:#0A0A12; color:#E0E0E0; font-family:sans-serif;
                       display:flex; align-items:center; justify-content:center;
                       height:100vh; margin:0; }
                .c { text-align:center; }
                h2 { color:#A855F7; font-size:28px; }
                p { color:#888; margin:16px 0; }
                button { background:linear-gradient(135deg,#A855F7,#EC4899);
                         color:white; border:none; padding:14px 32px;
                         border-radius:14px; font-size:16px; cursor:pointer; }
            </style></head>
            <body><div class="c">
                <h2>Meshlink</h2>
                <p>No internet connection</p>
                <button onclick="location.href='$serverUrl'">Retry</button>
            </div></body></html>
        """.trimIndent(), "text/html", "UTF-8")
    }

    // ===== Native Bridge (JS → Kotlin) =====
    inner class NativeBridge {
        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(this@WebViewActivity, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun getDeviceInfo(): String {
            return """{"platform":"android","version":"${Build.VERSION.RELEASE}","model":"${Build.MODEL}","sdk":${Build.VERSION.SDK_INT},"native":true}"""
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun getServerUrl(): String = serverUrl

        @JavascriptInterface
        fun vibrate(ms: Long) {
            val vibrator = getSystemService(android.os.Vibrator::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(android.os.VibrationEffect.createOneShot(ms, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
            }
        }

        @JavascriptInterface
        fun showNotification(title: String, body: String) {
            val nm = getSystemService(NotificationManager::class.java)
            val notification = NotificationCompat.Builder(this@WebViewActivity, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()
            nm.notify(System.currentTimeMillis().toInt(), notification)
        }

        @JavascriptInterface
        fun shareText(text: String) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
            }
            startActivity(Intent.createChooser(intent, "Share"))
        }

        @JavascriptInterface
        fun copyToClipboard(text: String) {
            val clipboard = getSystemService(android.content.ClipboardManager::class.java)
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Meshlink", text))
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }

        @JavascriptInterface
        fun getAppVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun getBatteryLevel(): Int {
            val bm = getSystemService(android.os.BatteryManager::class.java)
            return bm?.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        }

        @JavascriptInterface
        fun isOnline(): Boolean {
            val cm = getSystemService(android.net.ConnectivityManager::class.java)
            return cm?.activeNetwork != null
        }
    }

    // ===== Permissions =====
    private fun requestPermissions() {
        val perms = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.VIBRATE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Meshlink Messages",
                NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New message notifications"
                enableVibration(true)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    // ===== Activity lifecycle =====
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == RESULT_OK && data != null) {
                data.data?.let { arrayOf(it) }
            } else null
            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 1001
        private const val PERMISSION_REQUEST = 1002
        private const val CHANNEL_ID = "meshlink_messages"
    }
}
