package io.meshlink.app.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Error handling + network utilities.
 * Graceful degradation — show cached data when offline.
 */
object NetworkUtils {

    /** Check if device has internet connection */
    fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Show offline toast */
    fun showOfflineToast(context: Context) {
        Toast.makeText(context, "No internet connection", Toast.LENGTH_SHORT).show()
    }

    /** Safe API call with error handling */
    suspend fun <T> safeCall(
        context: Context,
        fallback: T,
        showError: Boolean = true,
        block: suspend () -> T
    ): T {
        return try {
            if (!isOnline(context)) {
                if (showError) withContext(Dispatchers.Main) { showOfflineToast(context) }
                fallback
            } else {
                block()
            }
        } catch (e: java.net.SocketTimeoutException) {
            if (showError) withContext(Dispatchers.Main) {
                Toast.makeText(context, "Connection timeout", Toast.LENGTH_SHORT).show()
            }
            fallback
        } catch (e: java.net.UnknownHostException) {
            if (showError) withContext(Dispatchers.Main) {
                Toast.makeText(context, "Server not reachable", Toast.LENGTH_SHORT).show()
            }
            fallback
        } catch (e: Exception) {
            if (showError) withContext(Dispatchers.Main) {
                Toast.makeText(context, "Error: ${e.message?.take(50)}", Toast.LENGTH_SHORT).show()
            }
            fallback
        }
    }
}

/**
 * Retry helper — retries a block with exponential backoff.
 */
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelay: Long = 1000,
    maxDelay: Long = 10000,
    block: suspend () -> T
): T {
    var currentDelay = initialDelay
    repeat(maxRetries - 1) {
        try {
            return block()
        } catch (_: Exception) {
            kotlinx.coroutines.delay(currentDelay)
            currentDelay = (currentDelay * 2).coerceAtMost(maxDelay)
        }
    }
    return block() // Last attempt — let exception propagate
}
