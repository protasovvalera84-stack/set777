package io.meshlink.app.network

import android.content.Context
import io.meshlink.app.data.MediaCacheEntity
import io.meshlink.app.data.MeshlinkDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Media manager — handles upload/download with local cache.
 * All media stored in app's private directory (deleted on uninstall).
 * Cache-first: check local file before downloading from server.
 */
class MediaManager(
    private val context: Context,
    private val database: MeshlinkDatabase,
    private val baseUrl: String
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    // Private media directory (invisible to user, deleted on uninstall)
    private val mediaDir: File by lazy {
        File(context.filesDir, ".meshlink_media").also { it.mkdirs() }
    }

    /**
     * Get media file — cache-first.
     * Returns local file path if cached, downloads if not.
     */
    suspend fun getMedia(mxcUrl: String, token: String): File? = withContext(Dispatchers.IO) {
        // Check cache first
        val cached = database.mediaCacheDao().get(mxcUrl)
        if (cached != null) {
            val file = File(cached.localPath)
            if (file.exists()) return@withContext file
        }

        // Download from server
        val httpUrl = mxcToHttp(mxcUrl) ?: return@withContext null
        try {
            val request = Request.Builder()
                .url(httpUrl)
                .addHeader("Authorization", "Bearer $token")
                .build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            val body = response.body ?: return@withContext null
            val ext = guessExtension(response.header("Content-Type"))
            val fileName = mxcUrl.hashCode().toString(16) + ext
            val file = File(mediaDir, fileName)

            FileOutputStream(file).use { out ->
                body.byteStream().use { input ->
                    input.copyTo(out)
                }
            }

            // Save to cache DB
            database.mediaCacheDao().upsert(MediaCacheEntity(
                mxcUrl = mxcUrl,
                localPath = file.absolutePath,
                mimeType = response.header("Content-Type"),
                size = file.length()
            ))

            file
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Upload media file to server.
     * Returns mxc:// URI.
     */
    suspend fun uploadMedia(file: File, token: String): String? = withContext(Dispatchers.IO) {
        try {
            val mimeType = guessMimeType(file.name)
            val requestBody = file.asRequestBody(mimeType.toMediaType())
            val request = Request.Builder()
                .url("$baseUrl/_matrix/media/v3/upload?filename=${file.name}")
                .addHeader("Authorization", "Bearer $token")
                .post(requestBody)
                .build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            val json = response.body?.string() ?: return@withContext null
            val mxcUrl = com.google.gson.JsonParser.parseString(json)
                .asJsonObject.get("content_uri")?.asString

            // Cache the uploaded file locally
            if (mxcUrl != null) {
                val cachedFile = File(mediaDir, mxcUrl.hashCode().toString(16) + getExtension(file.name))
                if (!cachedFile.exists()) file.copyTo(cachedFile, overwrite = true)
                database.mediaCacheDao().upsert(MediaCacheEntity(
                    mxcUrl = mxcUrl,
                    localPath = cachedFile.absolutePath,
                    mimeType = mimeType,
                    size = cachedFile.length()
                ))
            }

            mxcUrl
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Get thumbnail URL for an image.
     */
    fun getThumbnailUrl(mxcUrl: String?, width: Int = 128, height: Int = 128): String? {
        if (mxcUrl == null || !mxcUrl.startsWith("mxc://")) return null
        val parts = mxcUrl.removePrefix("mxc://").split("/", limit = 2)
        if (parts.size != 2) return null
        return "$baseUrl/_matrix/media/v3/thumbnail/${parts[0]}/${parts[1]}?width=$width&height=$height&method=crop"
    }

    /**
     * Clean old cache entries (keep last 30 days).
     */
    suspend fun cleanCache(maxAgeDays: Int = 30) = withContext(Dispatchers.IO) {
        val cutoff = System.currentTimeMillis() - (maxAgeDays * 24 * 60 * 60 * 1000L)
        database.mediaCacheDao().deleteOlderThan(cutoff)
        // Delete orphaned files
        mediaDir.listFiles()?.forEach { file ->
            if (file.lastModified() < cutoff) file.delete()
        }
    }

    /**
     * Get total cache size in bytes.
     */
    suspend fun getCacheSize(): Long = withContext(Dispatchers.IO) {
        database.mediaCacheDao().totalSize() ?: 0L
    }

    /**
     * Clear all cached media.
     */
    suspend fun clearCache() = withContext(Dispatchers.IO) {
        database.mediaCacheDao().deleteOlderThan(Long.MAX_VALUE)
        mediaDir.listFiles()?.forEach { it.delete() }
    }

    private fun mxcToHttp(mxcUrl: String): String? {
        if (!mxcUrl.startsWith("mxc://")) return null
        val parts = mxcUrl.removePrefix("mxc://").split("/", limit = 2)
        if (parts.size != 2) return null
        return "$baseUrl/_matrix/media/v3/download/${parts[0]}/${parts[1]}"
    }

    private fun guessExtension(contentType: String?): String = when {
        contentType?.contains("jpeg") == true || contentType?.contains("jpg") == true -> ".jpg"
        contentType?.contains("png") == true -> ".png"
        contentType?.contains("gif") == true -> ".gif"
        contentType?.contains("webp") == true -> ".webp"
        contentType?.contains("mp4") == true -> ".mp4"
        contentType?.contains("webm") == true -> ".webm"
        contentType?.contains("ogg") == true -> ".ogg"
        contentType?.contains("mp3") == true || contentType?.contains("mpeg") == true -> ".mp3"
        contentType?.contains("pdf") == true -> ".pdf"
        else -> ".bin"
    }

    private fun guessMimeType(fileName: String): String = when {
        fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") -> "image/jpeg"
        fileName.endsWith(".png") -> "image/png"
        fileName.endsWith(".gif") -> "image/gif"
        fileName.endsWith(".webp") -> "image/webp"
        fileName.endsWith(".mp4") -> "video/mp4"
        fileName.endsWith(".webm") -> "video/webm"
        fileName.endsWith(".ogg") -> "audio/ogg"
        fileName.endsWith(".mp3") -> "audio/mpeg"
        fileName.endsWith(".pdf") -> "application/pdf"
        else -> "application/octet-stream"
    }

    private fun getExtension(fileName: String): String {
        val dot = fileName.lastIndexOf('.')
        return if (dot >= 0) fileName.substring(dot) else ".bin"
    }
}
