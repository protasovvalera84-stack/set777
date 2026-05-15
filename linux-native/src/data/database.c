#include "database.h"
#include <stdio.h>
#include <string.h>

struct _MeshlinkDB { sqlite3 *db; };

MeshlinkDB *meshlink_db_new(void) {
    MeshlinkDB *mdb = g_new0(MeshlinkDB, 1);
    char *path = g_build_filename(g_get_user_data_dir(), "meshlink", "meshlink.db", NULL);
    g_mkdir_with_parents(g_path_get_dirname(path), 0700);
    sqlite3_open(path, &mdb->db);
    g_free(path);

    sqlite3_exec(mdb->db,
        "CREATE TABLE IF NOT EXISTS rooms (room_id TEXT PRIMARY KEY, name TEXT, avatar_url TEXT, topic TEXT, "
        "last_message TEXT, last_message_time INTEGER DEFAULT 0, unread_count INTEGER DEFAULT 0, is_direct INTEGER DEFAULT 0);"
        "CREATE TABLE IF NOT EXISTS messages (event_id TEXT PRIMARY KEY, room_id TEXT, sender TEXT, body TEXT, "
        "msgtype TEXT DEFAULT 'm.text', timestamp INTEGER, media_url TEXT);"
        "CREATE INDEX IF NOT EXISTS idx_msg_room ON messages(room_id);",
        NULL, NULL, NULL);
    return mdb;
}

void meshlink_db_free(MeshlinkDB *db) {
    if (db) { sqlite3_close(db->db); g_free(db); }
}

void meshlink_db_upsert_room(MeshlinkDB *db, DBRoom *room) {
    sqlite3_stmt *stmt;
    sqlite3_prepare_v2(db->db,
        "INSERT OR REPLACE INTO rooms VALUES (?,?,?,?,?,?,?,?)", -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, room->room_id, -1, NULL);
    sqlite3_bind_text(stmt, 2, room->name, -1, NULL);
    sqlite3_bind_text(stmt, 3, room->avatar_url, -1, NULL);
    sqlite3_bind_text(stmt, 4, room->topic, -1, NULL);
    sqlite3_bind_text(stmt, 5, room->last_message, -1, NULL);
    sqlite3_bind_int64(stmt, 6, room->last_message_time);
    sqlite3_bind_int(stmt, 7, room->unread_count);
    sqlite3_bind_int(stmt, 8, room->is_direct);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

GList *meshlink_db_get_rooms(MeshlinkDB *db) {
    GList *rooms = NULL;
    sqlite3_stmt *stmt;
    sqlite3_prepare_v2(db->db, "SELECT * FROM rooms ORDER BY last_message_time DESC", -1, &stmt, NULL);
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        DBRoom *r = g_new0(DBRoom, 1);
        r->room_id = g_strdup((const char*)sqlite3_column_text(stmt, 0));
        r->name = g_strdup((const char*)sqlite3_column_text(stmt, 1));
        r->avatar_url = sqlite3_column_text(stmt, 2) ? g_strdup((const char*)sqlite3_column_text(stmt, 2)) : NULL;
        r->topic = sqlite3_column_text(stmt, 3) ? g_strdup((const char*)sqlite3_column_text(stmt, 3)) : NULL;
        r->last_message = sqlite3_column_text(stmt, 4) ? g_strdup((const char*)sqlite3_column_text(stmt, 4)) : NULL;
        r->last_message_time = sqlite3_column_int64(stmt, 5);
        r->unread_count = sqlite3_column_int(stmt, 6);
        r->is_direct = sqlite3_column_int(stmt, 7);
        rooms = g_list_append(rooms, r);
    }
    sqlite3_finalize(stmt);
    return rooms;
}

void meshlink_db_upsert_message(MeshlinkDB *db, DBMessage *msg) {
    sqlite3_stmt *stmt;
    sqlite3_prepare_v2(db->db,
        "INSERT OR REPLACE INTO messages VALUES (?,?,?,?,?,?,?)", -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, msg->event_id, -1, NULL);
    sqlite3_bind_text(stmt, 2, msg->room_id, -1, NULL);
    sqlite3_bind_text(stmt, 3, msg->sender, -1, NULL);
    sqlite3_bind_text(stmt, 4, msg->body, -1, NULL);
    sqlite3_bind_text(stmt, 5, msg->msgtype, -1, NULL);
    sqlite3_bind_int64(stmt, 6, msg->timestamp);
    sqlite3_bind_text(stmt, 7, msg->media_url, -1, NULL);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

GList *meshlink_db_get_messages(MeshlinkDB *db, const char *room_id, int limit) {
    GList *msgs = NULL;
    sqlite3_stmt *stmt;
    sqlite3_prepare_v2(db->db,
        "SELECT * FROM messages WHERE room_id=? ORDER BY timestamp DESC LIMIT ?", -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, room_id, -1, NULL);
    sqlite3_bind_int(stmt, 2, limit);
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        DBMessage *m = g_new0(DBMessage, 1);
        m->event_id = g_strdup((const char*)sqlite3_column_text(stmt, 0));
        m->room_id = g_strdup((const char*)sqlite3_column_text(stmt, 1));
        m->sender = g_strdup((const char*)sqlite3_column_text(stmt, 2));
        m->body = g_strdup((const char*)sqlite3_column_text(stmt, 3));
        m->msgtype = g_strdup((const char*)sqlite3_column_text(stmt, 4));
        m->timestamp = sqlite3_column_int64(stmt, 5);
        m->media_url = sqlite3_column_text(stmt, 6) ? g_strdup((const char*)sqlite3_column_text(stmt, 6)) : NULL;
        msgs = g_list_append(msgs, m);
    }
    sqlite3_finalize(stmt);
    return msgs;
}

void meshlink_db_clear(MeshlinkDB *db) {
    sqlite3_exec(db->db, "DELETE FROM rooms; DELETE FROM messages;", NULL, NULL, NULL);
}

void db_room_free(DBRoom *r) {
    if (!r) return;
    g_free(r->room_id); g_free(r->name); g_free(r->avatar_url);
    g_free(r->topic); g_free(r->last_message); g_free(r);
}

void db_message_free(DBMessage *m) {
    if (!m) return;
    g_free(m->event_id); g_free(m->room_id); g_free(m->sender);
    g_free(m->body); g_free(m->msgtype); g_free(m->media_url); g_free(m);
}
