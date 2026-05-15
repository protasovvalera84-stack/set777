package io.meshlink.app.data

import android.content.Context
import androidx.room.*

/**
 * Local SQLite database — all messages, rooms, media cached here.
 * Stored in app's private directory (auto-deleted on uninstall).
 */
@Database(entities = [RoomEntity::class, MessageEntity::class, MediaCacheEntity::class], version = 1)
abstract class MeshlinkDatabase : RoomDatabase() {
    abstract fun roomDao(): RoomDao
    abstract fun messageDao(): MessageDao
    abstract fun mediaCacheDao(): MediaCacheDao

    companion object {
        fun create(context: Context): MeshlinkDatabase {
            return Room.databaseBuilder(context, MeshlinkDatabase::class.java, "meshlink.db")
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}

// ===== Room (chat room) =====

@Entity(tableName = "rooms")
data class RoomEntity(
    @PrimaryKey val roomId: String,
    val name: String,
    val avatarUrl: String? = null,
    val topic: String? = null,
    val lastMessage: String? = null,
    val lastMessageTime: Long = 0,
    val unreadCount: Int = 0,
    val isDirect: Boolean = false
)

@Dao
interface RoomDao {
    @Query("SELECT * FROM rooms ORDER BY lastMessageTime DESC")
    suspend fun getAll(): List<RoomEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(room: RoomEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rooms: List<RoomEntity>)

    @Query("DELETE FROM rooms WHERE roomId = :roomId")
    suspend fun delete(roomId: String)

    @Query("DELETE FROM rooms")
    suspend fun deleteAll()
}

// ===== Message =====

@Entity(tableName = "messages", indices = [Index("roomId")])
data class MessageEntity(
    @PrimaryKey val eventId: String,
    val roomId: String,
    val sender: String,
    val body: String,
    val msgtype: String = "m.text",
    val timestamp: Long,
    val mediaUrl: String? = null,
    val localMediaPath: String? = null
)

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE roomId = :roomId ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getByRoom(roomId: String, limit: Int = 100): List<MessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(messages: List<MessageEntity>)

    @Query("DELETE FROM messages WHERE roomId = :roomId")
    suspend fun deleteByRoom(roomId: String)

    @Query("DELETE FROM messages")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM messages WHERE roomId = :roomId")
    suspend fun countByRoom(roomId: String): Int
}

// ===== Media Cache =====

@Entity(tableName = "media_cache")
data class MediaCacheEntity(
    @PrimaryKey val mxcUrl: String,
    val localPath: String,
    val mimeType: String? = null,
    val size: Long = 0,
    val cachedAt: Long = System.currentTimeMillis()
)

@Dao
interface MediaCacheDao {
    @Query("SELECT * FROM media_cache WHERE mxcUrl = :mxcUrl")
    suspend fun get(mxcUrl: String): MediaCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: MediaCacheEntity)

    @Query("DELETE FROM media_cache WHERE cachedAt < :before")
    suspend fun deleteOlderThan(before: Long)

    @Query("SELECT SUM(size) FROM media_cache")
    suspend fun totalSize(): Long?
}
