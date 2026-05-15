package io.meshlink.app.network

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Matrix Client-Server API — direct HTTP calls.
 * No heavy SDK dependency. Full control over requests.
 * All data flows through this class.
 */
class MatrixApi(private var baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    // ===== Auth =====

    /** Login with username and password */
    suspend fun login(user: String, password: String): LoginResponse = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf(
            "type" to "m.login.password",
            "user" to user,
            "password" to password,
            "initial_device_display_name" to "Meshlink Android"
        ))
        val resp = post("/_matrix/client/v3/login", body)
        gson.fromJson(resp, LoginResponse::class.java)
    }

    /** Register a new account */
    suspend fun register(user: String, password: String): LoginResponse = withContext(Dispatchers.IO) {
        val body = gson.toJson(mapOf(
            "username" to user,
            "password" to password,
            "auth" to mapOf("type" to "m.login.dummy"),
            "initial_device_display_name" to "Meshlink Android"
        ))
        val resp = post("/_matrix/client/v3/register", body)
        gson.fromJson(resp, LoginResponse::class.java)
    }

    /** Logout */
    suspend fun logout(token: String) = withContext(Dispatchers.IO) {
        post("/_matrix/client/v3/logout", "{}", token)
    }

    // ===== Rooms =====

    /** Get joined rooms */
    suspend fun getJoinedRooms(token: String): List<String> = withContext(Dispatchers.IO) {
        val resp = get("/_matrix/client/v3/joined_rooms", token)
        val json = gson.fromJson(resp, JsonObject::class.java)
        json.getAsJsonArray("joined_rooms")?.map { it.asString } ?: emptyList()
    }

    /** Get room name and info */
    suspend fun getRoomState(roomId: String, token: String): RoomInfo = withContext(Dispatchers.IO) {
        val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
        val resp = get("/_matrix/client/v3/rooms/$encoded/state", token)
        val events = gson.fromJson(resp, Array<JsonObject>::class.java)
        var name = roomId
        var avatar: String? = null
        var topic: String? = null
        for (event in events) {
            when (event.get("type")?.asString) {
                "m.room.name" -> name = event.getAsJsonObject("content")?.get("name")?.asString ?: name
                "m.room.avatar" -> avatar = event.getAsJsonObject("content")?.get("url")?.asString
                "m.room.topic" -> topic = event.getAsJsonObject("content")?.get("topic")?.asString
            }
        }
        RoomInfo(roomId, name, avatar, topic)
    }

    /** Get room messages */
    suspend fun getMessages(roomId: String, token: String, limit: Int = 50): List<Message> = withContext(Dispatchers.IO) {
        val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
        val resp = get("/_matrix/client/v3/rooms/$encoded/messages?dir=b&limit=$limit", token)
        val json = gson.fromJson(resp, JsonObject::class.java)
        val messages = mutableListOf<Message>()
        json.getAsJsonArray("chunk")?.forEach { evt ->
            val obj = evt.asJsonObject
            if (obj.get("type")?.asString == "m.room.message") {
                val content = obj.getAsJsonObject("content")
                messages.add(Message(
                    eventId = obj.get("event_id")?.asString ?: "",
                    roomId = roomId,
                    sender = obj.get("sender")?.asString ?: "",
                    body = content?.get("body")?.asString ?: "",
                    msgtype = content?.get("msgtype")?.asString ?: "m.text",
                    timestamp = obj.get("origin_server_ts")?.asLong ?: 0
                ))
            }
        }
        messages
    }

    /** Send a text message */
    suspend fun sendMessage(roomId: String, text: String, token: String): String = withContext(Dispatchers.IO) {
        val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
        val txnId = "m${System.currentTimeMillis()}"
        val body = gson.toJson(mapOf("msgtype" to "m.text", "body" to text))
        val resp = put("/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txnId", body, token)
        val json = gson.fromJson(resp, JsonObject::class.java)
        json.get("event_id")?.asString ?: ""
    }

    /** Sync (long-poll for new events) */
    suspend fun sync(token: String, since: String? = null, timeout: Int = 30000): SyncResponse = withContext(Dispatchers.IO) {
        val params = mutableListOf("timeout=$timeout")
        if (since != null) params.add("since=$since")
        val resp = get("/_matrix/client/v3/sync?${params.joinToString("&")}", token)
        gson.fromJson(resp, SyncResponse::class.java)
    }

    /** Convert mxc:// URL to HTTP URL */
    fun mxcToHttp(mxcUrl: String?): String? {
        if (mxcUrl == null || !mxcUrl.startsWith("mxc://")) return null
        val parts = mxcUrl.removePrefix("mxc://").split("/", limit = 2)
        if (parts.size != 2) return null
        return "$baseUrl/_matrix/media/v3/download/${parts[0]}/${parts[1]}"
    }

    // ===== HTTP helpers =====

    private fun get(path: String, token: String? = null): String {
        val builder = Request.Builder().url("$baseUrl$path").get()
        if (token != null) builder.addHeader("Authorization", "Bearer $token")
        val response = client.newCall(builder.build()).execute()
        return response.body?.string() ?: "{}"
    }

    private fun post(path: String, json: String, token: String? = null): String {
        val builder = Request.Builder().url("$baseUrl$path")
            .post(json.toRequestBody(jsonType))
        if (token != null) builder.addHeader("Authorization", "Bearer $token")
        val response = client.newCall(builder.build()).execute()
        return response.body?.string() ?: "{}"
    }

    private fun put(path: String, json: String, token: String? = null): String {
        val builder = Request.Builder().url("$baseUrl$path")
            .put(json.toRequestBody(jsonType))
        if (token != null) builder.addHeader("Authorization", "Bearer $token")
        val response = client.newCall(builder.build()).execute()
        return response.body?.string() ?: "{}"
    }
}

// ===== Data classes =====

data class LoginResponse(
    val user_id: String? = null,
    val access_token: String? = null,
    val device_id: String? = null,
    val errcode: String? = null,
    val error: String? = null
)

data class RoomInfo(
    val roomId: String,
    val name: String,
    val avatarUrl: String? = null,
    val topic: String? = null
)

data class Message(
    val eventId: String,
    val roomId: String,
    val sender: String,
    val body: String,
    val msgtype: String,
    val timestamp: Long
)

data class SyncResponse(
    val next_batch: String? = null,
    val rooms: SyncRooms? = null
)

data class SyncRooms(
    val join: Map<String, SyncJoinedRoom>? = null
)

data class SyncJoinedRoom(
    val timeline: SyncTimeline? = null
)

data class SyncTimeline(
    val events: List<JsonObject>? = null
)
