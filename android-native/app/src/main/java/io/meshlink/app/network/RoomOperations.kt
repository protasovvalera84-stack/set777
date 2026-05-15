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
 * Room operations — join, leave, invite, ban, set topic, set avatar.
 */
class RoomOperations(private val baseUrl: String) {

    private val client = OkHttpClient()
    private val gson = Gson()

    /** Join a room by ID or alias */
    suspend fun join(roomIdOrAlias: String, token: String): String? = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomIdOrAlias, "UTF-8")
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/join/$encoded")
                .addHeader("Authorization", "Bearer $token")
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()).execute()
            JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString
        } catch (_: Exception) { null }
    }

    /** Leave a room */
    suspend fun leave(roomId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/leave")
                .addHeader("Authorization", "Bearer $token")
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Invite user to room */
    suspend fun invite(roomId: String, userId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val body = gson.toJson(mapOf("user_id" to userId))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/invite")
                .addHeader("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Kick user from room */
    suspend fun kick(roomId: String, userId: String, reason: String?, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val data = mutableMapOf<String, String>("user_id" to userId)
            if (reason != null) data["reason"] = reason
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/kick")
                .addHeader("Authorization", "Bearer $token")
                .post(gson.toJson(data).toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Ban user from room */
    suspend fun ban(roomId: String, userId: String, reason: String?, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val data = mutableMapOf<String, String>("user_id" to userId)
            if (reason != null) data["reason"] = reason
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/ban")
                .addHeader("Authorization", "Bearer $token")
                .post(gson.toJson(data).toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Set room topic */
    suspend fun setTopic(roomId: String, topic: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val body = gson.toJson(mapOf("topic" to topic))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/state/m.room.topic/")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Set room name */
    suspend fun setName(roomId: String, name: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val body = gson.toJson(mapOf("name" to name))
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/state/m.room.name/")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Create public room */
    suspend fun createPublicRoom(name: String, topic: String?, token: String): String? = withContext(Dispatchers.IO) {
        try {
            val data = mutableMapOf<String, Any>(
                "name" to name,
                "preset" to "public_chat",
                "visibility" to "public"
            )
            if (topic != null) data["topic"] = topic
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/createRoom")
                .addHeader("Authorization", "Bearer $token")
                .post(gson.toJson(data).toRequestBody("application/json".toMediaType()))
                .build()).execute()
            JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString
        } catch (_: Exception) { null }
    }

    /** Get room members count */
    suspend fun getMemberCount(roomId: String, token: String): Int = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/rooms/$encoded/joined_members")
                .addHeader("Authorization", "Bearer $token")
                .build()).execute()
            val json = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
            json.getAsJsonObject("joined")?.size() ?: 0
        } catch (_: Exception) { 0 }
    }
}
