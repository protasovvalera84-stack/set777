package io.meshlink.app.network

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import io.meshlink.app.MeshlinkApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Connection monitor — detects online/offline state changes.
 * When connection restored: flushes offline queue, restarts sync.
 */
class ConnectionMonitor(private val context: Context) {

    private var isConnected = true
    private var callback: NetworkCallback? = null
    var onConnectionChanged: ((Boolean) -> Unit)? = null

    fun start() {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        callback = NetworkCallback()
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        cm.registerNetworkCallback(request, callback!!)

        // Check initial state
        val network = cm.activeNetwork
        val caps = cm.getNetworkCapabilities(network)
        isConnected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    fun stop() {
        callback?.let {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            cm.unregisterNetworkCallback(it)
        }
        callback = null
    }

    fun isOnline() = isConnected

    private inner class NetworkCallback : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (!isConnected) {
                isConnected = true
                onConnectionChanged?.invoke(true)
                // Flush offline queue
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val app = MeshlinkApp.instance
                        val token = app.securePrefs.accessToken ?: return@launch
                        val queue = OfflineQueue(context, app.database, app.matrixApi)
                        val sent = queue.flush(token)
                        if (sent > 0) {
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                android.widget.Toast.makeText(context, "$sent messages sent", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (_: Exception) {}
                }
                // Restart sync
                context.startService(Intent(context, SyncService::class.java))
            }
        }

        override fun onLost(network: Network) {
            isConnected = false
            onConnectionChanged?.invoke(false)
        }
    }
}
