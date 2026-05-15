package io.meshlink.app.network

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Read receipts + Typing indicators — Matrix protocol support.
 */
class PresenceManager(private val baseUrl: String) {

    private val client = OkHttpClient()
    private val gson = Gson()

    /**
     * Send read receipt for a message.
     */
    suspend fun sendReadReceipt(roomId: String, eventId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encodedRoom = java.net.URLEncoder.encode(roomId, "UTF-8")
            val encodedEvent = java.net.URLEncoder.encode(eventId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encodedRoom/receipt/m.read/$encodedEvent")
                .addHeader("Authorization", "Bearer $token")
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /**
     * Send typing notification.
     */
    suspend fun sendTyping(roomId: String, userId: String, typing: Boolean, token: String, timeoutMs: Int = 5000) = withContext(Dispatchers.IO) {
        try {
            val encodedRoom = java.net.URLEncoder.encode(roomId, "UTF-8")
            val encodedUser = java.net.URLEncoder.encode(userId, "UTF-8")
            val body = if (typing) {
                gson.toJson(mapOf("typing" to true, "timeout" to timeoutMs))
            } else {
                gson.toJson(mapOf("typing" to false))
            }
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encodedRoom/typing/$encodedUser")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /**
     * Set user presence (online/offline/unavailable).
     */
    suspend fun setPresence(userId: String, presence: String, statusMsg: String?, token: String) = withContext(Dispatchers.IO) {
        try {
            val encodedUser = java.net.URLEncoder.encode(userId, "UTF-8")
            val data = mutableMapOf<String, Any>("presence" to presence)
            if (statusMsg != null) data["status_msg"] = statusMsg
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/presence/$encodedUser/status")
                .addHeader("Authorization", "Bearer $token")
                .put(gson.toJson(data).toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /**
     * Get user presence.
     */
    suspend fun getPresence(userId: String, token: String): UserPresence? = withContext(Dispatchers.IO) {
        try {
            val encodedUser = java.net.URLEncoder.encode(userId, "UTF-8")
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/presence/$encodedUser/status")
                .addHeader("Authorization", "Bearer $token")
                .build()).execute()
            if (!resp.isSuccessful) return@withContext null
            val json = com.google.gson.JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
            UserPresence(
                presence = json.get("presence")?.asString ?: "offline",
                statusMsg = json.get("status_msg")?.asString,
                lastActiveAgo = json.get("last_active_ago")?.asLong
            )
        } catch (_: Exception) { null }
    }

    /**
     * Mark room as fully read.
     */
    suspend fun markRoomRead(roomId: String, eventId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encodedRoom = java.net.URLEncoder.encode(roomId, "UTF-8")
            val body = gson.toJson(mapOf(
                "m.fully_read" to eventId,
                "m.read" to eventId
            ))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encodedRoom/read_markers")
                .addHeader("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }
}

data class UserPresence(
    val presence: String,  // "online", "offline", "unavailable"
    val statusMsg: String?,
    val lastActiveAgo: Long?
)
