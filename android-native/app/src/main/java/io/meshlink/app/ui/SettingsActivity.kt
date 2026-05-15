package io.meshlink.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.launch

/**
 * Settings screen — notifications, storage, security, about.
 */
class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        val app = MeshlinkApp.instance

        // Notification toggle
        val switchNotif = findViewById<Switch>(R.id.switchNotifications)
        switchNotif?.isChecked = app.getSharedPreferences("settings", MODE_PRIVATE)
            .getBoolean("notifications", true)
        switchNotif?.setOnCheckedChangeListener { _, checked ->
            app.getSharedPreferences("settings", MODE_PRIVATE)
                .edit().putBoolean("notifications", checked).apply()
        }

        // Theme toggle
        val switchDark = findViewById<Switch>(R.id.switchDarkMode)
        switchDark?.isChecked = true // Always dark for now
        switchDark?.isEnabled = false

        // Storage info
        val tvStorage = findViewById<TextView>(R.id.tvStorageInfo)
        val btnClearAll = findViewById<Button>(R.id.btnClearAllData)

        lifecycleScope.launch {
            val mediaManager = MediaManager(
                this@SettingsActivity, app.database, app.securePrefs.serverUrl ?: ""
            )
            val cacheSize = mediaManager.getCacheSize()
            val msgCount = app.database.messageDao().countByRoom("%") // approximate
            val roomCount = app.database.roomDao().getAll().size
            tvStorage?.text = "Cache: ${cacheSize / (1024 * 1024)}MB\nRooms: $roomCount\nMessages cached locally"
        }

        btnClearAll?.setOnClickListener {
            android.app.AlertDialog.Builder(this, R.style.DialogTheme)
                .setTitle("Clear All Data")
                .setMessage("This will delete all cached messages, media, and settings. You will need to log in again.")
                .setPositiveButton("Clear") { _, _ ->
                    lifecycleScope.launch {
                        app.database.messageDao().deleteAll()
                        app.database.roomDao().deleteAll()
                        val mediaManager = MediaManager(
                            this@SettingsActivity, app.database, app.securePrefs.serverUrl ?: ""
                        )
                        mediaManager.clearCache()
                        app.securePrefs.clear()
                        startActivity(Intent(this@SettingsActivity, LoginActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
                        finish()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        // Version info
        val tvVersion = findViewById<TextView>(R.id.tvVersion)
        try {
            val version = packageManager.getPackageInfo(packageName, 0).versionName
            tvVersion?.text = "Meshlink v$version"
        } catch (_: Exception) {
            tvVersion?.text = "Meshlink v1.0.0"
        }

        // Server info
        val tvServer = findViewById<TextView>(R.id.tvServer)
        tvServer?.text = app.securePrefs.serverUrl ?: "Unknown"
    }
}
