/**
 * Matrix Client implementation using libsoup3.
 */

#include "matrix_client.h"
#include <libsoup/soup.h>
#include <string.h>
#include <stdio.h>

struct _MatrixClient {
    char *base_url;
    SoupSession *session;
};

MatrixClient *matrix_client_new(const char *base_url) {
    MatrixClient *client = g_new0(MatrixClient, 1);
    client->base_url = g_strdup(base_url);
    client->session = soup_session_new();
    /* Accept self-signed certs */
    g_object_set(client->session, "ssl-strict", FALSE, NULL);
    return client;
}

void matrix_client_free(MatrixClient *client) {
    if (!client) return;
    g_free(client->base_url);
    g_object_unref(client->session);
    g_free(client);
}

/* Helper: make HTTP request and return JSON */
static JsonNode *do_request(MatrixClient *client, const char *method, const char *path,
                            const char *body, const char *token) {
    char *url = g_strdup_printf("%s%s", client->base_url, path);
    SoupMessage *msg = soup_message_new(method, url);
    g_free(url);

    if (token) {
        char *auth = g_strdup_printf("Bearer %s", token);
        soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
        g_free(auth);
    }

    if (body) {
        GBytes *bytes = g_bytes_new(body, strlen(body));
        soup_message_set_request_body_from_bytes(msg, "application/json", bytes);
        g_bytes_unref(bytes);
    }

    GError *error = NULL;
    GBytes *resp_bytes = soup_session_send_and_read(client->session, msg, NULL, &error);
    g_object_unref(msg);

    if (error) { g_error_free(error); return NULL; }
    if (!resp_bytes) return NULL;

    gsize size;
    const char *data = g_bytes_get_data(resp_bytes, &size);
    JsonParser *parser = json_parser_new();
    json_parser_load_from_data(parser, data, size, NULL);
    JsonNode *root = json_parser_get_root(parser) ? json_node_copy(json_parser_get_root(parser)) : NULL;
    g_object_unref(parser);
    g_bytes_unref(resp_bytes);
    return root;
}

/* Auth */
LoginResponse *matrix_client_login(MatrixClient *client, const char *user, const char *password) {
    char *body = g_strdup_printf(
        "{\"type\":\"m.login.password\",\"user\":\"%s\",\"password\":\"%s\","
        "\"initial_device_display_name\":\"Meshlink Linux\"}", user, password);
    JsonNode *node = do_request(client, "POST", "/_matrix/client/v3/login", body, NULL);
    g_free(body);

    LoginResponse *resp = g_new0(LoginResponse, 1);
    if (node) {
        JsonObject *obj = json_node_get_object(node);
        if (json_object_has_member(obj, "access_token")) {
            resp->user_id = g_strdup(json_object_get_string_member(obj, "user_id"));
            resp->access_token = g_strdup(json_object_get_string_member(obj, "access_token"));
            resp->device_id = json_object_has_member(obj, "device_id") ?
                g_strdup(json_object_get_string_member(obj, "device_id")) : NULL;
        } else {
            resp->error = json_object_has_member(obj, "error") ?
                g_strdup(json_object_get_string_member(obj, "error")) : g_strdup("Login failed");
        }
        json_node_unref(node);
    }
    return resp;
}

LoginResponse *matrix_client_register(MatrixClient *client, const char *user, const char *password) {
    char *body = g_strdup_printf(
        "{\"username\":\"%s\",\"password\":\"%s\",\"auth\":{\"type\":\"m.login.dummy\"},"
        "\"initial_device_display_name\":\"Meshlink Linux\"}", user, password);
    JsonNode *node = do_request(client, "POST", "/_matrix/client/v3/register", body, NULL);
    g_free(body);

    LoginResponse *resp = g_new0(LoginResponse, 1);
    if (node) {
        JsonObject *obj = json_node_get_object(node);
        if (json_object_has_member(obj, "access_token")) {
            resp->user_id = g_strdup(json_object_get_string_member(obj, "user_id"));
            resp->access_token = g_strdup(json_object_get_string_member(obj, "access_token"));
            resp->device_id = json_object_has_member(obj, "device_id") ?
                g_strdup(json_object_get_string_member(obj, "device_id")) : NULL;
        } else {
            resp->error = json_object_has_member(obj, "error") ?
                g_strdup(json_object_get_string_member(obj, "error")) : g_strdup("Registration failed");
        }
        json_node_unref(node);
    }
    return resp;
}

void matrix_client_logout(MatrixClient *client, const char *token) {
    do_request(client, "POST", "/_matrix/client/v3/logout", "{}", token);
}

void login_response_free(LoginResponse *resp) {
    if (!resp) return;
    g_free(resp->user_id); g_free(resp->access_token);
    g_free(resp->device_id); g_free(resp->error);
    g_free(resp);
}

/* Rooms */
GList *matrix_client_get_joined_rooms(MatrixClient *client, const char *token) {
    JsonNode *node = do_request(client, "GET", "/_matrix/client/v3/joined_rooms", NULL, token);
    GList *rooms = NULL;
    if (node) {
        JsonArray *arr = json_object_get_array_member(json_node_get_object(node), "joined_rooms");
        if (arr) {
            for (guint i = 0; i < json_array_get_length(arr); i++)
                rooms = g_list_append(rooms, g_strdup(json_array_get_string_element(arr, i)));
        }
        json_node_unref(node);
    }
    return rooms;
}

RoomInfo *matrix_client_get_room_state(MatrixClient *client, const char *room_id, const char *token) {
    char *encoded = g_uri_escape_string(room_id, NULL, TRUE);
    char *path = g_strdup_printf("/_matrix/client/v3/rooms/%s/state", encoded);
    JsonNode *node = do_request(client, "GET", path, NULL, token);
    g_free(path); g_free(encoded);

    RoomInfo *info = g_new0(RoomInfo, 1);
    info->room_id = g_strdup(room_id);
    info->name = g_strdup(room_id);

    if (node && JSON_NODE_HOLDS_ARRAY(node)) {
        JsonArray *arr = json_node_get_array(node);
        for (guint i = 0; i < json_array_get_length(arr); i++) {
            JsonObject *evt = json_array_get_object_element(arr, i);
            const char *type = json_object_get_string_member(evt, "type");
            JsonObject *content = json_object_get_object_member(evt, "content");
            if (g_strcmp0(type, "m.room.name") == 0 && content) {
                g_free(info->name);
                info->name = g_strdup(json_object_get_string_member(content, "name"));
            }
            if (g_strcmp0(type, "m.room.avatar") == 0 && content)
                info->avatar_url = g_strdup(json_object_get_string_member(content, "url"));
            if (g_strcmp0(type, "m.room.topic") == 0 && content)
                info->topic = g_strdup(json_object_get_string_member(content, "topic"));
        }
        json_node_unref(node);
    }
    return info;
}

void room_info_free(RoomInfo *info) {
    if (!info) return;
    g_free(info->room_id); g_free(info->name);
    g_free(info->avatar_url); g_free(info->topic);
    g_free(info);
}

/* Messages */
GList *matrix_client_get_messages(MatrixClient *client, const char *room_id, const char *token, int limit) {
    char *encoded = g_uri_escape_string(room_id, NULL, TRUE);
    char *path = g_strdup_printf("/_matrix/client/v3/rooms/%s/messages?dir=b&limit=%d", encoded, limit);
    JsonNode *node = do_request(client, "GET", path, NULL, token);
    g_free(path); g_free(encoded);

    GList *messages = NULL;
    if (node) {
        JsonArray *chunk = json_object_get_array_member(json_node_get_object(node), "chunk");
        if (chunk) {
            for (guint i = 0; i < json_array_get_length(chunk); i++) {
                JsonObject *evt = json_array_get_object_element(chunk, i);
                if (g_strcmp0(json_object_get_string_member(evt, "type"), "m.room.message") != 0) continue;
                JsonObject *content = json_object_get_object_member(evt, "content");
                MatrixMessage *msg = g_new0(MatrixMessage, 1);
                msg->event_id = g_strdup(json_object_get_string_member(evt, "event_id"));
                msg->room_id = g_strdup(room_id);
                msg->sender = g_strdup(json_object_get_string_member(evt, "sender"));
                msg->body = content ? g_strdup(json_object_get_string_member(content, "body")) : g_strdup("");
                msg->msgtype = content ? g_strdup(json_object_get_string_member(content, "msgtype")) : g_strdup("m.text");
                msg->timestamp = json_object_get_int_member(evt, "origin_server_ts");
                msg->media_url = (content && json_object_has_member(content, "url")) ?
                    g_strdup(json_object_get_string_member(content, "url")) : NULL;
                messages = g_list_append(messages, msg);
            }
        }
        json_node_unref(node);
    }
    return messages;
}

char *matrix_client_send_message(MatrixClient *client, const char *room_id, const char *text, const char *token) {
    char *encoded = g_uri_escape_string(room_id, NULL, TRUE);
    gint64 now = g_get_real_time() / 1000;
    char *path = g_strdup_printf("/_matrix/client/v3/rooms/%s/send/m.room.message/m%ld", encoded, now);
    char *body = g_strdup_printf("{\"msgtype\":\"m.text\",\"body\":\"%s\"}", text);
    JsonNode *node = do_request(client, "PUT", path, body, token);
    g_free(path); g_free(body); g_free(encoded);

    char *event_id = NULL;
    if (node) {
        event_id = g_strdup(json_object_get_string_member(json_node_get_object(node), "event_id"));
        json_node_unref(node);
    }
    return event_id;
}

void matrix_message_free(MatrixMessage *msg) {
    if (!msg) return;
    g_free(msg->event_id); g_free(msg->room_id); g_free(msg->sender);
    g_free(msg->body); g_free(msg->msgtype); g_free(msg->media_url);
    g_free(msg);
}

char *matrix_client_mxc_to_http(MatrixClient *client, const char *mxc_url) {
    if (!mxc_url || !g_str_has_prefix(mxc_url, "mxc://")) return NULL;
    const char *rest = mxc_url + 6;
    char **parts = g_strsplit(rest, "/", 2);
    if (!parts[0] || !parts[1]) { g_strfreev(parts); return NULL; }
    char *url = g_strdup_printf("%s/_matrix/media/v3/download/%s/%s", client->base_url, parts[0], parts[1]);
    g_strfreev(parts);
    return url;
}

/* Sync + Search stubs */
SyncResponse *matrix_client_sync(MatrixClient *client, const char *token, const char *since, int timeout) {
    char *path = since ?
        g_strdup_printf("/_matrix/client/v3/sync?timeout=%d&since=%s", timeout, since) :
        g_strdup_printf("/_matrix/client/v3/sync?timeout=%d", timeout);
    JsonNode *node = do_request(client, "GET", path, NULL, token);
    g_free(path);

    SyncResponse *resp = g_new0(SyncResponse, 1);
    if (node) {
        JsonObject *obj = json_node_get_object(node);
        resp->next_batch = g_strdup(json_object_get_string_member(obj, "next_batch"));
        json_node_unref(node);
    }
    return resp;
}

void sync_response_free(SyncResponse *resp) {
    if (!resp) return;
    g_free(resp->next_batch);
    g_list_free_full(resp->new_messages, (GDestroyNotify)matrix_message_free);
    g_free(resp);
}

GList *matrix_client_search_users(MatrixClient *client, const char *query, const char *token, int limit) {
    char *body = g_strdup_printf("{\"search_term\":\"%s\",\"limit\":%d}", query, limit);
    JsonNode *node = do_request(client, "POST", "/_matrix/client/v3/user_directory/search", body, token);
    g_free(body);

    GList *results = NULL;
    if (node) {
        JsonArray *arr = json_object_get_array_member(json_node_get_object(node), "results");
        if (arr) {
            for (guint i = 0; i < json_array_get_length(arr); i++) {
                JsonObject *r = json_array_get_object_element(arr, i);
                UserSearchResult *usr = g_new0(UserSearchResult, 1);
                usr->user_id = g_strdup(json_object_get_string_member(r, "user_id"));
                usr->display_name = json_object_has_member(r, "display_name") ?
                    g_strdup(json_object_get_string_member(r, "display_name")) : NULL;
                results = g_list_append(results, usr);
            }
        }
        json_node_unref(node);
    }
    return results;
}

void user_search_result_free(UserSearchResult *result) {
    if (!result) return;
    g_free(result->user_id); g_free(result->display_name); g_free(result->avatar_url);
    g_free(result);
}
