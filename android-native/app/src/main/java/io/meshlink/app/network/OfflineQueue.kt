package io.meshlink.app.network
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.content.Context
import com.google.gson.Gson
import io.meshlink.app.data.MessageEntity
import io.meshlink.app.data.MeshlinkDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Offline message queue — stores messages when no connection.
 * Retries sending when connection restored.
 * All queued messages in app's private SQLite.
 */
class OfflineQueue(
    private val context: Context,
    private val database: MeshlinkDatabase,
    private val matrixApi: MatrixApi
) {
    data class QueuedMessage(
        val id: String,
        val roomId: String,
        val body: String,
        val msgtype: String = "m.text",
        val mediaUrl: String? = null,
        val timestamp: Long = System.currentTimeMillis(),
        var retries: Int = 0
    )

    private val queue = mutableListOf<QueuedMessage>()
    private val prefs = context.getSharedPreferences("offline_queue", Context.MODE_PRIVATE)

    init {
        loadQueue()
    }

    /** Add message to offline queue */
    fun enqueue(roomId: String, body: String, msgtype: String = "m.text", mediaUrl: String? = null) {
        val msg = QueuedMessage(
            id = "q${System.currentTimeMillis()}.${(Math.random() * 1000).toInt()}",
            roomId = roomId, body = body, msgtype = msgtype, mediaUrl = mediaUrl
        )
        queue.add(msg)
        saveQueue()

        // Also save to local DB so it appears in chat immediately
        kotlinx.coroutines.GlobalScope.launch(Dispatchers.IO) {
            val userId = io.meshlink.app.MeshlinkApp.instance.securePrefs.userId ?: ""
            database.messageDao().upsert(MessageEntity(
                eventId = msg.id, roomId = roomId, sender = userId,
                body = body, msgtype = msgtype, timestamp = msg.timestamp,
                mediaUrl = mediaUrl
            ))
        }
    }

    /** Try to send all queued messages */
    suspend fun flush(token: String): Int = withContext(Dispatchers.IO) {
        var sent = 0
        val iterator = queue.iterator()
        while (iterator.hasNext()) {
            val msg = iterator.next()
            try {
                if (msg.msgtype == "m.text") {
                    matrixApi.sendMessage(msg.roomId, msg.body, token)
                } else {
                    // Media message
                    val encoded = java.net.URLEncoder.encode(msg.roomId, "UTF-8")
                    val txn = "q${System.currentTimeMillis()}"
                    val body = Gson().toJson(mapOf(
                        "msgtype" to msg.msgtype,
                        "body" to msg.body,
                        "url" to msg.mediaUrl
                    ))
                    val request = okhttp3.Request.Builder()
                        .url("${io.meshlink.app.MeshlinkApp.instance.securePrefs.serverUrl}/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(body.toRequestBody("application/json".toMediaType()))
                        .build()
                    okhttp3.OkHttpClient().newCall(request).execute()
                }
                iterator.remove()
                sent++
            } catch (_: Exception) {
                msg.retries++
                if (msg.retries > 10) iterator.remove() // Give up after 10 retries
            }
        }
        saveQueue()
        sent
    }

    /** Get queue size */
    fun size() = queue.size

    /** Check if there are pending messages */
    fun hasPending() = queue.isNotEmpty()

    private fun saveQueue() {
        prefs.edit().putString("queue", Gson().toJson(queue)).apply()
    }

    private fun loadQueue() {
        try {
            val json = prefs.getString("queue", "[]") ?: "[]"
            val items = Gson().fromJson(json, Array<QueuedMessage>::class.java)
            queue.clear()
            queue.addAll(items)
        } catch (_: Exception) {}
    }
}
