package io.meshlink.app.network

import android.content.Context
import android.content.pm.PackageManager
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Auto-updater — checks server for new APK version.
 * Downloads and prompts user to install.
 */
class AutoUpdater(private val context: Context) {

    data class UpdateInfo(
        val version: String,
        val downloadUrl: String,
        val changelog: String,
        val size: Long
    )

    /**
     * Check if a newer version is available on the server.
     */
    suspend fun checkForUpdate(): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val app = io.meshlink.app.MeshlinkApp.instance
            val baseUrl = app.securePrefs.serverUrl ?: return@withContext null

            // Check version endpoint
            val resp = OkHttpClient().newCall(Request.Builder()
                .url("$baseUrl/installers/version.json")
                .build()).execute()

            if (!resp.isSuccessful) return@withContext null
            val json = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject

            val serverVersion = json.get("version")?.asString ?: return@withContext null
            val currentVersion = getCurrentVersion()

            if (isNewer(serverVersion, currentVersion)) {
                UpdateInfo(
                    version = serverVersion,
                    downloadUrl = "$baseUrl/installers/Meshlink-Native.apk",
                    changelog = json.get("changelog")?.asString ?: "Bug fixes and improvements",
                    size = json.get("size")?.asLong ?: 0
                )
            } else null
        } catch (_: Exception) { null }
    }

    private fun getCurrentVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0.0.0"
        } catch (_: PackageManager.NameNotFoundException) { "0.0.0" }
    }

    private fun isNewer(server: String, current: String): Boolean {
        val s = server.split(".").map { it.toIntOrNull() ?: 0 }
        val c = current.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(s.size, c.size)) {
            val sv = s.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (sv > cv) return true
            if (sv < cv) return false
        }
        return false
    }
}
