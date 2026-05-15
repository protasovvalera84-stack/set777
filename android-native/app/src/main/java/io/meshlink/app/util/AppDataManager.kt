package io.meshlink.app.util

import android.content.Context
import android.os.Build
import java.io.File

/**
 * App data manager — handles storage, cleanup, stats.
 * All data in app's private directory (auto-deleted on uninstall).
 */
class AppDataManager(private val context: Context) {

    /** Get total app data size in bytes */
    fun getTotalSize(): Long {
        return getDirSize(context.filesDir) +
            getDirSize(context.cacheDir) +
            getDirSize(context.getDatabasePath("meshlink.db").parentFile)
    }

    /** Get media cache size */
    fun getMediaCacheSize(): Long {
        return getDirSize(File(context.filesDir, ".meshlink_media"))
    }

    /** Get voice messages size */
    fun getVoiceCacheSize(): Long {
        return getDirSize(File(context.filesDir, ".meshlink_voice"))
    }

    /** Get database size */
    fun getDatabaseSize(): Long {
        val dbFile = context.getDatabasePath("meshlink.db")
        return if (dbFile.exists()) dbFile.length() else 0
    }

    /** Clear media cache */
    fun clearMediaCache() {
        deleteDir(File(context.filesDir, ".meshlink_media"))
        deleteDir(File(context.filesDir, ".meshlink_camera"))
    }

    /** Clear voice messages */
    fun clearVoiceCache() {
        deleteDir(File(context.filesDir, ".meshlink_voice"))
    }

    /** Clear all app data (except credentials) */
    fun clearAllData() {
        clearMediaCache()
        clearVoiceCache()
        context.cacheDir.listFiles()?.forEach { it.deleteRecursively() }
    }

    /** Format bytes to human-readable string */
    fun formatSize(bytes: Long): String {
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> "${bytes / 1024} KB"
            bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
            else -> "${"%.1f".format(bytes.toDouble() / (1024 * 1024 * 1024))} GB"
        }
    }

    /** Get storage stats as formatted string */
    fun getStorageStats(): String {
        val total = formatSize(getTotalSize())
        val media = formatSize(getMediaCacheSize())
        val voice = formatSize(getVoiceCacheSize())
        val db = formatSize(getDatabaseSize())
        return "Total: $total\nMedia: $media\nVoice: $voice\nDatabase: $db"
    }

    /** Get device info */
    fun getDeviceInfo(): String {
        return buildString {
            appendLine("Device: ${Build.MANUFACTURER} ${Build.MODEL}")
            appendLine("Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            appendLine("App: ${context.packageName}")
            try {
                val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName
                appendLine("Version: $version")
            } catch (_: Exception) {}
        }
    }

    private fun getDirSize(dir: File?): Long {
        if (dir == null || !dir.exists()) return 0
        var size = 0L
        dir.walkTopDown().forEach { file ->
            if (file.isFile) size += file.length()
        }
        return size
    }

    private fun deleteDir(dir: File) {
        if (dir.exists()) dir.deleteRecursively()
        dir.mkdirs()
    }
}
