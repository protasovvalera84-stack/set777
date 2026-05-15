package io.meshlink.app.ui

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.ProfileManager
import io.meshlink.app.util.AppDataManager
import kotlinx.coroutines.launch

/**
 * About screen — app info, server info, storage, crash logs, debug.
 */
class AboutActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        val app = MeshlinkApp.instance
        val dataManager = AppDataManager(this)

        // App info
        findViewById<TextView>(R.id.tvAppVersion)?.text = try {
            "v${packageManager.getPackageInfo(packageName, 0).versionName}"
        } catch (_: Exception) { "v1.0.0" }

        // Server info
        findViewById<TextView>(R.id.tvServer)?.text = app.securePrefs.serverUrl ?: "Unknown"
        findViewById<TextView>(R.id.tvUserId)?.text = app.securePrefs.userId ?: "Not logged in"
        findViewById<TextView>(R.id.tvDeviceId)?.text = app.securePrefs.deviceId ?: "Unknown"

        // Storage
        findViewById<TextView>(R.id.tvStorage)?.text = dataManager.getStorageStats()

        // Device info
        findViewById<TextView>(R.id.tvDeviceInfo)?.text = dataManager.getDeviceInfo()

        // Performance
        findViewById<TextView>(R.id.tvPerformance)?.text = io.meshlink.app.util.PerformanceMonitor.getReport()

        // Memory
        findViewById<TextView>(R.id.tvMemory)?.text = "Memory: ${io.meshlink.app.util.PerformanceMonitor.getMemoryUsage()}"

        // Crash logs
        val crashReporter = io.meshlink.app.util.CrashReporter(this)
        val lastCrash = crashReporter.getLastCrash()
        findViewById<TextView>(R.id.tvCrashLog)?.text = lastCrash?.take(500) ?: "No crashes recorded"

        findViewById<Button>(R.id.btnClearCrashLogs)?.setOnClickListener {
            crashReporter.clearCrashLogs()
            findViewById<TextView>(R.id.tvCrashLog)?.text = "Cleared"
            Toast.makeText(this, "Crash logs cleared", Toast.LENGTH_SHORT).show()
        }

        // Devices list
        lifecycleScope.launch {
            val token = app.securePrefs.accessToken ?: return@launch
            val profileManager = ProfileManager(app.securePrefs.serverUrl ?: "")
            val devices = profileManager.getDevices(token)
            findViewById<TextView>(R.id.tvDevices)?.text = devices.joinToString("\n") { d ->
                "${d.displayName ?: d.deviceId} — ${d.lastSeenIp ?: "unknown IP"}"
            }.ifEmpty { "No devices" }
        }
    }
}
