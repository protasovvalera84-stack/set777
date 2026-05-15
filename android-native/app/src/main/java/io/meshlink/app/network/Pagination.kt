package io.meshlink.app.network

import io.meshlink.app.MeshlinkApp
import io.meshlink.app.data.MessageEntity
import io.meshlink.app.data.RoomEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Pagination manager — loads messages in pages.
 * First loads from local DB (instant), then fetches from server.
 * Supports infinite scroll with "load more" at top.
 */
class MessagePaginator(
    private val roomId: String,
    private val pageSize: Int = 30
) {
    private var fromToken: String? = null
    private var hasMore = true
    private var isLoading = false
    private val loadedIds = mutableSetOf<String>()

    /**
     * Load initial messages — from cache first, then server.
     */
    suspend fun loadInitial(): List<MessageEntity> = withContext(Dispatchers.IO) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return@withContext emptyList()

        // Cache first
        val cached = app.database.messageDao().getByRoom(roomId, pageSize)
        loadedIds.addAll(cached.map { it.eventId })

        // Server
        try {
            val messages = app.matrixApi.getMessages(roomId, token, pageSize)
            val entities = messages.map { toEntity(it) }
            val newEntities = entities.filter { it.eventId !in loadedIds }
            if (newEntities.isNotEmpty()) {
                app.database.messageDao().upsertAll(newEntities)
                loadedIds.addAll(newEntities.map { it.eventId })
            }
            hasMore = messages.size >= pageSize
            app.database.messageDao().getByRoom(roomId, pageSize)
        } catch (_: Exception) {
            cached
        }
    }

    /**
     * Load older messages (scroll up).
     */
    suspend fun loadMore(): List<MessageEntity> = withContext(Dispatchers.IO) {
        if (!hasMore || isLoading) return@withContext emptyList()
        isLoading = true

        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return@withContext emptyList<MessageEntity>().also { isLoading = false }

        try {
            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
            var url = "${app.securePrefs.serverUrl}/_matrix/client/v3/rooms/$encoded/messages?dir=b&limit=$pageSize"
            if (fromToken != null) url += "&from=$fromToken"

            val resp = okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                .url(url).addHeader("Authorization", "Bearer $token").build()).execute()
            val json = com.google.gson.JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject

            fromToken = json.get("end")?.asString
            val messages = mutableListOf<MessageEntity>()
            json.getAsJsonArray("chunk")?.forEach { evt ->
                val obj = evt.asJsonObject
                if (obj.get("type")?.asString == "m.room.message") {
                    val c = obj.getAsJsonObject("content") ?: return@forEach
                    val entity = MessageEntity(
                        eventId = obj.get("event_id")?.asString ?: return@forEach,
                        roomId = roomId,
                        sender = obj.get("sender")?.asString ?: "",
                        body = c.get("body")?.asString ?: "",
                        msgtype = c.get("msgtype")?.asString ?: "m.text",
                        timestamp = obj.get("origin_server_ts")?.asLong ?: 0,
                        mediaUrl = c.get("url")?.asString
                    )
                    if (entity.eventId !in loadedIds) {
                        messages.add(entity)
                        loadedIds.add(entity.eventId)
                    }
                }
            }
            hasMore = messages.size >= pageSize
            if (messages.isNotEmpty()) app.database.messageDao().upsertAll(messages)
            messages
        } catch (_: Exception) {
            emptyList<MessageEntity>()
        } finally {
            isLoading = false
        }
    }

    fun hasMoreMessages() = hasMore
    fun isCurrentlyLoading() = isLoading

    private fun toEntity(msg: io.meshlink.app.network.Message) = MessageEntity(
        eventId = msg.eventId, roomId = msg.roomId,
        sender = msg.sender, body = msg.body,
        msgtype = msg.msgtype, timestamp = msg.timestamp
    )
}

/**
 * Room list manager — handles room sorting, filtering, search.
 */
class RoomManager {

    enum class SortMode { RECENT, UNREAD, NAME }
    enum class FilterMode { ALL, DIRECT, GROUPS }

    /**
     * Sort and filter rooms.
     */
    fun process(
        rooms: List<RoomEntity>,
        sort: SortMode = SortMode.RECENT,
        filter: FilterMode = FilterMode.ALL,
        search: String = ""
    ): List<RoomEntity> {
        var result = rooms

        // Filter
        result = when (filter) {
            FilterMode.DIRECT -> result.filter { it.isDirect }
            FilterMode.GROUPS -> result.filter { !it.isDirect }
            FilterMode.ALL -> result
        }

        // Search
        if (search.isNotBlank()) {
            val q = search.lowercase()
            result = result.filter { it.name.lowercase().contains(q) }
        }

        // Sort
        result = when (sort) {
            SortMode.RECENT -> result.sortedByDescending { it.lastMessageTime }
            SortMode.UNREAD -> result.sortedByDescending { it.unreadCount }
            SortMode.NAME -> result.sortedBy { it.name.lowercase() }
        }

        return result
    }
}
