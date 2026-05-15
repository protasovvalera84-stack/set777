using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Data.Sqlite;

namespace Meshlink.Services
{
    /// <summary>
    /// Local SQLite database — stores rooms, messages, media cache.
    /// All data in AppData\Local\Meshlink (auto-deleted on uninstall).
    /// </summary>
    public class LocalDatabase : IDisposable
    {
        private readonly SqliteConnection _conn;

        public LocalDatabase()
        {
            var dbPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Meshlink", "meshlink.db"
            );
            Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
            _conn = new SqliteConnection($"Data Source={dbPath}");
            _conn.Open();
            CreateTables();
        }

        private void CreateTables()
        {
            Execute(@"
                CREATE TABLE IF NOT EXISTS rooms (
                    room_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    avatar_url TEXT,
                    topic TEXT,
                    last_message TEXT,
                    last_message_time INTEGER DEFAULT 0,
                    unread_count INTEGER DEFAULT 0,
                    is_direct INTEGER DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS messages (
                    event_id TEXT PRIMARY KEY,
                    room_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    body TEXT NOT NULL,
                    msgtype TEXT DEFAULT 'm.text',
                    timestamp INTEGER NOT NULL,
                    media_url TEXT,
                    local_path TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
                CREATE TABLE IF NOT EXISTS media_cache (
                    mxc_url TEXT PRIMARY KEY,
                    local_path TEXT NOT NULL,
                    mime_type TEXT,
                    size INTEGER DEFAULT 0,
                    cached_at INTEGER
                );
            ");
        }

        // ===== Rooms =====

        public List<Models.RoomModel> GetRooms()
        {
            var rooms = new List<Models.RoomModel>();
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM rooms ORDER BY last_message_time DESC";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                rooms.Add(new Models.RoomModel
                {
                    RoomId = reader.GetString(0),
                    Name = reader.GetString(1),
                    AvatarUrl = reader.IsDBNull(2) ? null : reader.GetString(2),
                    Topic = reader.IsDBNull(3) ? null : reader.GetString(3),
                    LastMessage = reader.IsDBNull(4) ? null : reader.GetString(4),
                    LastMessageTime = reader.GetInt64(5),
                    UnreadCount = reader.GetInt32(6),
                    IsDirect = reader.GetInt32(7) == 1
                });
            }
            return rooms;
        }

        public void UpsertRoom(Models.RoomModel room)
        {
            Execute(@"INSERT OR REPLACE INTO rooms (room_id, name, avatar_url, topic, last_message, last_message_time, unread_count, is_direct)
                VALUES (@rid, @name, @avatar, @topic, @lm, @lmt, @uc, @direct)",
                ("@rid", room.RoomId), ("@name", room.Name), ("@avatar", room.AvatarUrl ?? (object)DBNull.Value),
                ("@topic", room.Topic ?? (object)DBNull.Value), ("@lm", room.LastMessage ?? (object)DBNull.Value),
                ("@lmt", room.LastMessageTime), ("@uc", room.UnreadCount), ("@direct", room.IsDirect ? 1 : 0));
        }

        // ===== Messages =====

        public List<Models.MessageModel> GetMessages(string roomId, int limit = 100)
        {
            var messages = new List<Models.MessageModel>();
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM messages WHERE room_id = @rid ORDER BY timestamp DESC LIMIT @limit";
            cmd.Parameters.AddWithValue("@rid", roomId);
            cmd.Parameters.AddWithValue("@limit", limit);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                messages.Add(new Models.MessageModel
                {
                    EventId = reader.GetString(0),
                    RoomId = reader.GetString(1),
                    Sender = reader.GetString(2),
                    Body = reader.GetString(3),
                    MsgType = reader.GetString(4),
                    Timestamp = reader.GetInt64(5),
                    MediaUrl = reader.IsDBNull(6) ? null : reader.GetString(6)
                });
            }
            return messages;
        }

        public void UpsertMessage(Models.MessageModel msg)
        {
            Execute(@"INSERT OR REPLACE INTO messages (event_id, room_id, sender, body, msgtype, timestamp, media_url)
                VALUES (@eid, @rid, @sender, @body, @type, @ts, @media)",
                ("@eid", msg.EventId), ("@rid", msg.RoomId), ("@sender", msg.Sender),
                ("@body", msg.Body), ("@type", msg.MsgType), ("@ts", msg.Timestamp),
                ("@media", msg.MediaUrl ?? (object)DBNull.Value));
        }

        public void DeleteAllRooms() => Execute("DELETE FROM rooms");
        public void DeleteAllMessages() => Execute("DELETE FROM messages");

        // ===== Helpers =====

        private void Execute(string sql, params (string name, object value)[] parameters)
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, value) in parameters)
                cmd.Parameters.AddWithValue(name, value);
            cmd.ExecuteNonQuery();
        }

        public void Dispose() => _conn?.Dispose();
    }
}
