package io.meshlink.app.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import io.meshlink.app.BuildConfig
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R

/**
 * Hybrid WebView Activity — loads the web UI for identical look & feel.
 * Native Kotlin handles: push notifications, background sync, camera, files.
 * Web UI handles: all rendering, animations, design system.
 *
 * This ensures Android app looks EXACTLY like the web version.
 */
class WebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val serverUrl = BuildConfig.SERVER_URL

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_webview)

        webView = findViewById(R.id.webView)

        // Configure WebView for full web app experience
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            setSupportMultipleWindows(false)
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
            // Enable modern web features
            setSupportZoom(false)
        }

        // Handle navigation inside WebView
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                // Keep Matrix URLs inside WebView
                if (url.startsWith(serverUrl) || url.contains("/_matrix/")) {
                    return false
                }
                // Open external links in browser
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                return true
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    // Show offline message or retry
                    view?.loadData(
                        """<html><body style="background:#0A0A12;color:#E0E0E0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                        <div style="text-align:center">
                        <h2 style="color:#A855F7">Meshlink</h2>
                        <p>No connection. Check your internet.</p>
                        <button onclick="location.reload()" style="background:#A855F7;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:16px;margin-top:16px">Retry</button>
                        </div></body></html>""",
                        "text/html", "UTF-8"
                    )
                }
            }
        }

        // Handle file uploads (camera, gallery)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent()
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    Toast.makeText(this@WebViewActivity, "Cannot open file chooser", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                // Auto-grant camera/mic for video calls
                request?.grant(request.resources)
            }
        }

        // Bridge: JavaScript can call native Kotlin functions
        webView.addJavascriptInterface(NativeBridge(), "MeshlinkNative")

        // Load the web app
        webView.loadUrl(serverUrl)
    }

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

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

    /**
     * Native bridge — web JS can call these functions.
     * Usage in JS: window.MeshlinkNative.showToast("Hello")
     */
    inner class NativeBridge {
        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(this@WebViewActivity, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun getDeviceInfo(): String {
            return """{"platform":"android","version":"${android.os.Build.VERSION.RELEASE}","model":"${android.os.Build.MODEL}","native":true}"""
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun getServerUrl(): String = serverUrl

        @JavascriptInterface
        fun vibrate(ms: Long) {
            val vibrator = getSystemService(android.os.Vibrator::class.java)
            vibrator?.vibrate(android.os.VibrationEffect.createOneShot(ms, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 1001
    }
}
