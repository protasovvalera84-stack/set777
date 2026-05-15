/**
 * SQLite local database — rooms, messages, media cache.
 */
#ifndef DATABASE_H
#define DATABASE_H
#include <sqlite3.h>
#include <glib.h>

typedef struct _MeshlinkDB MeshlinkDB;

typedef struct {
    char *room_id, *name, *avatar_url, *topic, *last_message;
    gint64 last_message_time;
    int unread_count, is_direct;
} DBRoom;

typedef struct {
    char *event_id, *room_id, *sender, *body, *msgtype, *media_url;
    gint64 timestamp;
} DBMessage;

MeshlinkDB *meshlink_db_new(void);
void meshlink_db_free(MeshlinkDB *db);
void meshlink_db_upsert_room(MeshlinkDB *db, DBRoom *room);
GList *meshlink_db_get_rooms(MeshlinkDB *db);
void meshlink_db_upsert_message(MeshlinkDB *db, DBMessage *msg);
GList *meshlink_db_get_messages(MeshlinkDB *db, const char *room_id, int limit);
void meshlink_db_clear(MeshlinkDB *db);
void db_room_free(DBRoom *r);
void db_message_free(DBMessage *m);
#endif
