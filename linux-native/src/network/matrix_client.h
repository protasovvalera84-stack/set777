/**
 * Matrix Client-Server API — HTTP calls using libsoup.
 */

#ifndef MATRIX_CLIENT_H
#define MATRIX_CLIENT_H

#include <glib.h>
#include <json-glib/json-glib.h>

typedef struct _MatrixClient MatrixClient;

typedef struct {
    char *user_id;
    char *access_token;
    char *device_id;
    char *error;
} LoginResponse;

typedef struct {
    char *room_id;
    char *name;
    char *avatar_url;
    char *topic;
} RoomInfo;

typedef struct {
    char *event_id;
    char *room_id;
    char *sender;
    char *body;
    char *msgtype;
    gint64 timestamp;
    char *media_url;
} MatrixMessage;

typedef struct {
    char *next_batch;
    GList *new_messages; /* List of MatrixMessage* */
} SyncResponse;

typedef struct {
    char *user_id;
    char *display_name;
    char *avatar_url;
} UserSearchResult;

/* Create/destroy */
MatrixClient *matrix_client_new(const char *base_url);
void matrix_client_free(MatrixClient *client);

/* Auth */
LoginResponse *matrix_client_login(MatrixClient *client, const char *user, const char *password);
LoginResponse *matrix_client_register(MatrixClient *client, const char *user, const char *password);
void matrix_client_logout(MatrixClient *client, const char *token);
void login_response_free(LoginResponse *resp);

/* Rooms */
GList *matrix_client_get_joined_rooms(MatrixClient *client, const char *token);
RoomInfo *matrix_client_get_room_state(MatrixClient *client, const char *room_id, const char *token);
void room_info_free(RoomInfo *info);

/* Messages */
GList *matrix_client_get_messages(MatrixClient *client, const char *room_id, const char *token, int limit);
char *matrix_client_send_message(MatrixClient *client, const char *room_id, const char *text, const char *token);
void matrix_message_free(MatrixMessage *msg);

/* Sync */
SyncResponse *matrix_client_sync(MatrixClient *client, const char *token, const char *since, int timeout);
void sync_response_free(SyncResponse *resp);

/* Search */
GList *matrix_client_search_users(MatrixClient *client, const char *query, const char *token, int limit);
void user_search_result_free(UserSearchResult *result);

/* Utils */
char *matrix_client_mxc_to_http(MatrixClient *client, const char *mxc_url);

#endif /* MATRIX_CLIENT_H */
