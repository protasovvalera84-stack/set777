package io.meshlink.app.network

import com.google.gson.Gson
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Push rules manager — manage notification rules per room.
 * Mute/unmute rooms, set keywords, priority messages.
 */
class PushRulesManager(private val baseUrl: String) {

    private val client = OkHttpClient()
    private val gson = Gson()

    /** Get all push rules */
    suspend fun getRules(token: String): String? = withContext(Dispatchers.IO) {
        try {
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/pushrules/")
                .addHeader("Authorization", "Bearer $token").build()).execute()
            resp.body?.string()
        } catch (_: Exception) { null }
    }

    /** Mute a room (set push rule to don't notify) */
    suspend fun muteRoom(roomId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val body = gson.toJson(mapOf(
                "actions" to listOf("dont_notify"),
                "conditions" to listOf(mapOf("kind" to "event_match", "key" to "room_id", "pattern" to roomId))
            ))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/pushrules/global/override/$encoded")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Unmute a room */
    suspend fun unmuteRoom(roomId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/pushrules/global/override/$encoded")
                .addHeader("Authorization", "Bearer $token")
                .delete()
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Add keyword notification rule */
    suspend fun addKeyword(keyword: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf(
                "actions" to listOf("notify", mapOf("set_tweak" to "highlight")),
                "pattern" to keyword
            ))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/pushrules/global/content/${java.net.URLEncoder.encode(keyword, "UTF-8")}")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }
}
