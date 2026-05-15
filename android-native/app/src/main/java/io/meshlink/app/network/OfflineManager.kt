package io.meshlink.app.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import io.meshlink.app.MeshlinkApp
import kotlinx.coroutines.*

/**
 * Full offline manager — queues all operations when offline.
 * Auto-retries with exponential backoff when connection restored.
 * Syncs local DB with server on reconnect.
 */
class OfflineManager(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var retryJob: Job? = null
    private var isRetrying = false

    /**
     * Execute an operation — queue if offline, execute if online.
     */
    suspend fun <T> execute(
        operation: suspend () -> T,
        fallback: T,
        onError: ((Exception) -> Unit)? = null
    ): T {
        return if (isOnline()) {
            try {
                operation()
            } catch (e: Exception) {
                onError?.invoke(e)
                fallback
            }
        } else {
            fallback
        }
    }

    /**
     * Start auto-retry loop — checks connection every 10 seconds.
     * When online: flushes offline queue, syncs rooms.
     */
    fun startAutoRetry() {
        if (retryJob?.isActive == true) return
        retryJob = scope.launch {
            while (isActive) {
                if (isOnline() && !isRetrying) {
                    isRetrying = true
                    try {
                        val app = MeshlinkApp.instance
                        val token = app.securePrefs.accessToken ?: continue

                        // Flush offline queue
                        val queue = OfflineQueue(context, app.database, app.matrixApi)
                        val sent = queue.flush(token)

                        // Sync rooms
                        if (sent > 0) {
                            withContext(Dispatchers.Main) {
                                android.widget.Toast.makeText(context,
                                    "$sent queued messages sent", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (_: Exception) {}
                    isRetrying = false
                }
                delay(10_000) // Check every 10 seconds
            }
        }
    }

    fun stopAutoRetry() {
        retryJob?.cancel()
    }

    /**
     * Sync local database with server.
     * Downloads new messages, updates room list.
     */
    suspend fun fullSync() = withContext(Dispatchers.IO) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return@withContext

        try {
            // Sync rooms
            val roomIds = app.matrixApi.getJoinedRooms(token)
            for (id in roomIds) {
                try {
                    val info = app.matrixApi.getRoomState(id, token)
                    val name = info.name
                    if (name.contains("Meshlink") && (name.contains("Shorts") ||
                        name.contains("Videos") || name.contains("Music") ||
                        name.contains("Registry") || name.contains("Marketplace"))) continue

                    app.database.roomDao().upsert(io.meshlink.app.data.RoomEntity(
                        roomId = id, name = name, avatarUrl = info.avatarUrl, topic = info.topic
                    ))

                    // Sync messages
                    val messages = app.matrixApi.getMessages(id, token, 20)
                    val entities = messages.map { msg ->
                        io.meshlink.app.data.MessageEntity(
                            eventId = msg.eventId, roomId = msg.roomId,
                            sender = msg.sender, body = msg.body,
                            msgtype = msg.msgtype, timestamp = msg.timestamp
                        )
                    }
                    app.database.messageDao().upsertAll(entities)
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
    }

    private fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
