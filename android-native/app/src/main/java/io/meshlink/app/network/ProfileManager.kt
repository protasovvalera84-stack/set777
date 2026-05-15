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
 * Profile manager — avatar upload, display name, status, account data.
 */
class ProfileManager(private val baseUrl: String) {

    private val client = OkHttpClient()
    private val gson = Gson()

    /** Get user profile */
    suspend fun getProfile(userId: String, token: String): UserProfile? = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/profile/$encoded")
                .addHeader("Authorization", "Bearer $token").build()).execute()
            if (!resp.isSuccessful) return@withContext null
            val json = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
            UserProfile(
                displayName = json.get("displayname")?.asString,
                avatarUrl = json.get("avatar_url")?.asString
            )
        } catch (_: Exception) { null }
    }

    /** Set display name */
    suspend fun setDisplayName(userId: String, name: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/profile/$encoded/displayname")
                .addHeader("Authorization", "Bearer $token")
                .put(gson.toJson(mapOf("displayname" to name)).toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Set avatar (upload image first, then set mxc URL) */
    suspend fun setAvatar(userId: String, mxcUrl: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/profile/$encoded/avatar_url")
                .addHeader("Authorization", "Bearer $token")
                .put(gson.toJson(mapOf("avatar_url" to mxcUrl)).toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Get account data */
    suspend fun getAccountData(userId: String, type: String, token: String): String? = withContext(Dispatchers.IO) {
        try {
            val encodedUser = java.net.URLEncoder.encode(userId, "UTF-8")
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/user/$encodedUser/account_data/$type")
                .addHeader("Authorization", "Bearer $token").build()).execute()
            if (resp.isSuccessful) resp.body?.string() else null
        } catch (_: Exception) { null }
    }

    /** Set account data */
    suspend fun setAccountData(userId: String, type: String, data: String, token: String) = withContext(Dispatchers.IO) {
        try {
            val encodedUser = java.net.URLEncoder.encode(userId, "UTF-8")
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/user/$encodedUser/account_data/$type")
                .addHeader("Authorization", "Bearer $token")
                .put(data.toRequestBody("application/json".toMediaType()))
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Get all devices for current user */
    suspend fun getDevices(token: String): List<DeviceInfo> = withContext(Dispatchers.IO) {
        try {
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/devices")
                .addHeader("Authorization", "Bearer $token").build()).execute()
            if (!resp.isSuccessful) return@withContext emptyList()
            val json = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
            json.getAsJsonArray("devices")?.map { d ->
                val obj = d.asJsonObject
                DeviceInfo(
                    deviceId = obj.get("device_id")?.asString ?: "",
                    displayName = obj.get("display_name")?.asString,
                    lastSeenIp = obj.get("last_seen_ip")?.asString,
                    lastSeenTs = obj.get("last_seen_ts")?.asLong
                )
            } ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    /** Delete a device (requires auth) */
    suspend fun deleteDevice(deviceId: String, token: String) = withContext(Dispatchers.IO) {
        try {
            client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/devices/$deviceId")
                .addHeader("Authorization", "Bearer $token")
                .delete()
                .build()).execute()
        } catch (_: Exception) {}
    }

    /** Change password */
    suspend fun changePassword(newPassword: String, token: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf(
                "new_password" to newPassword,
                "logout_devices" to false,
                "auth" to mapOf("type" to "m.login.password")
            ))
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/account/password")
                .addHeader("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
            resp.isSuccessful
        } catch (_: Exception) { false }
    }

    /** Deactivate account */
    suspend fun deactivateAccount(token: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("auth" to mapOf("type" to "m.login.password")))
            val resp = client.newCall(Request.Builder()
                .url("$baseUrl/_matrix/client/v3/account/deactivate")
                .addHeader("Authorization", "Bearer $token")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()).execute()
            resp.isSuccessful
        } catch (_: Exception) { false }
    }
}

data class UserProfile(val displayName: String?, val avatarUrl: String?)
data class DeviceInfo(val deviceId: String, val displayName: String?, val lastSeenIp: String?, val lastSeenTs: Long?)
