package io.meshlink.app.network

import android.app.Service
import android.content.Intent
import android.os.IBinder
import com.google.gson.JsonObject
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.data.MessageEntity
import io.meshlink.app.data.RoomEntity
import kotlinx.coroutines.*

/**
 * Background sync service — polls Matrix server for new events.
 * Runs as foreground service for reliable message delivery.
 * Stores all received messages in local SQLite.
 */
class SyncService : Service() {

    private var syncJob: Job? = null
    private var nextBatch: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (syncJob?.isActive == true) return START_STICKY

        syncJob = CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
            val app = MeshlinkApp.instance
            val token = app.securePrefs.accessToken ?: return@launch

            // Load last sync token
            nextBatch = app.getSharedPreferences("sync", MODE_PRIVATE)
                .getString("next_batch", null)

            while (isActive) {
                try {
                    val response = app.matrixApi.sync(token, nextBatch, timeout = 30000)

                    if (response.next_batch != null) {
                        nextBatch = response.next_batch
                        // Save sync token
                        app.getSharedPreferences("sync", MODE_PRIVATE)
                            .edit().putString("next_batch", nextBatch).apply()
                    }

                    // Process new messages
                    response.rooms?.join?.forEach { (roomId, room) ->
                        room.timeline?.events?.forEach { event ->
                            processEvent(roomId, event)
                        }
                    }
                } catch (e: Exception) {
                    // Connection error — wait and retry
                    delay(5000)
                }
            }
        }

        return START_STICKY
    }

    private suspend fun processEvent(roomId: String, event: JsonObject) {
        val app = MeshlinkApp.instance
        val type = event.get("type")?.asString ?: return

        when (type) {
            "m.room.message" -> {
                val content = event.getAsJsonObject("content") ?: return
                val msg = MessageEntity(
                    eventId = event.get("event_id")?.asString ?: return,
                    roomId = roomId,
                    sender = event.get("sender")?.asString ?: "",
                    body = content.get("body")?.asString ?: "",
                    msgtype = content.get("msgtype")?.asString ?: "m.text",
                    timestamp = event.get("origin_server_ts")?.asLong ?: System.currentTimeMillis(),
                    mediaUrl = content.get("url")?.asString
                )
                app.database.messageDao().upsert(msg)

                // Update room's last message
                app.database.roomDao().upsert(
                    RoomEntity(
                        roomId = roomId,
                        name = roomId, // Will be updated by room state
                        lastMessage = msg.body,
                        lastMessageTime = msg.timestamp
                    )
                )
            }
        }
    }

    override fun onDestroy() {
        syncJob?.cancel()
        super.onDestroy()
    }
}
