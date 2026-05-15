package io.meshlink.app.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * Image cache — LRU memory cache + disk cache.
 * Reduces network requests and memory usage.
 */
object ImageCache {

    // Memory cache: 1/8 of available memory
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = maxMemory / 8

    private val memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            return bitmap.byteCount / 1024
        }
    }

    /** Get bitmap from cache or download */
    suspend fun getBitmap(url: String, cacheDir: File? = null): Bitmap? {
        // Check memory cache
        memoryCache.get(url)?.let { return it }

        // Check disk cache
        if (cacheDir != null) {
            val diskFile = File(cacheDir, url.hashCode().toString(16) + ".cache")
            if (diskFile.exists()) {
                val bitmap = withContext(Dispatchers.IO) {
                    BitmapFactory.decodeFile(diskFile.absolutePath)
                }
                if (bitmap != null) {
                    memoryCache.put(url, bitmap)
                    return bitmap
                }
            }
        }

        // Download
        return withContext(Dispatchers.IO) {
            try {
                val connection = URL(url).openConnection()
                connection.connectTimeout = 10000
                connection.readTimeout = 15000
                val input = connection.getInputStream()
                val bitmap = BitmapFactory.decodeStream(input)
                input.close()

                if (bitmap != null) {
                    memoryCache.put(url, bitmap)
                    // Save to disk cache
                    if (cacheDir != null) {
                        val diskFile = File(cacheDir, url.hashCode().toString(16) + ".cache")
                        diskFile.outputStream().use { out ->
                            bitmap.compress(Bitmap.CompressFormat.WEBP, 80, out)
                        }
                    }
                }
                bitmap
            } catch (_: Exception) { null }
        }
    }

    /** Clear memory cache */
    fun clearMemory() {
        memoryCache.evictAll()
    }

    /** Get memory cache stats */
    fun getStats(): String {
        return "Memory: ${memoryCache.size()}/${memoryCache.maxSize()} KB"
    }
}

/**
 * Pagination helper for RecyclerView.
 * Loads more items when scrolling near the end.
 */
abstract class PaginationScrollListener(
    private val layoutManager: androidx.recyclerview.widget.LinearLayoutManager
) : androidx.recyclerview.widget.RecyclerView.OnScrollListener() {

    override fun onScrolled(recyclerView: androidx.recyclerview.widget.RecyclerView, dx: Int, dy: Int) {
        super.onScrolled(recyclerView, dx, dy)
        val visibleItemCount = layoutManager.childCount
        val totalItemCount = layoutManager.itemCount
        val firstVisibleItemPosition = layoutManager.findFirstVisibleItemPosition()

        if (!isLoading() && !isLastPage()) {
            if ((visibleItemCount + firstVisibleItemPosition) >= totalItemCount - 5
                && firstVisibleItemPosition >= 0) {
                loadMoreItems()
            }
        }
    }

    abstract fun loadMoreItems()
    abstract fun isLastPage(): Boolean
    abstract fun isLoading(): Boolean
}
