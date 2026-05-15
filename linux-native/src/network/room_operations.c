/**
 * Room operations — join, leave, invite, kick, ban, set topic/name.
 */

#include "matrix_client.h"
#include <libsoup/soup.h>
#include <string.h>

static char *do_room_request(MatrixClient *client, const char *method, const char *room_id,
                              const char *endpoint, const char *body, const char *token) {
    /* Get base_url from client (simplified — in production use accessor) */
    extern const char *matrix_client_get_base_url(MatrixClient *c);
    const char *base_url = matrix_client_get_base_url(client);

    char *encoded = g_uri_escape_string(room_id, NULL, TRUE);
    char *url = g_strdup_printf("%s/_matrix/client/v3/rooms/%s/%s", base_url, encoded, endpoint);
    g_free(encoded);

    SoupSession *session = soup_session_new();
    SoupMessage *msg = soup_message_new(method, url);
    g_free(url);

    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    g_free(auth);

    if (body) {
        GBytes *bytes = g_bytes_new(body, strlen(body));
        soup_message_set_request_body_from_bytes(msg, "application/json", bytes);
        g_bytes_unref(bytes);
    }

    GBytes *resp = soup_session_send_and_read(session, msg, NULL, NULL);
    char *result = NULL;
    if (resp) {
        gsize size;
        const char *data = g_bytes_get_data(resp, &size);
        result = g_strndup(data, size);
        g_bytes_unref(resp);
    }
    g_object_unref(msg);
    g_object_unref(session);
    return result;
}

void room_ops_join(MatrixClient *client, const char *room_id_or_alias, const char *token) {
    char *encoded = g_uri_escape_string(room_id_or_alias, NULL, TRUE);
    extern const char *matrix_client_get_base_url(MatrixClient *c);
    const char *base_url = matrix_client_get_base_url(client);
    char *url = g_strdup_printf("%s/_matrix/client/v3/join/%s", base_url, encoded);
    g_free(encoded);

    SoupSession *session = soup_session_new();
    SoupMessage *msg = soup_message_new("POST", url);
    g_free(url);
    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    GBytes *bytes = g_bytes_new("{}", 2);
    soup_message_set_request_body_from_bytes(msg, "application/json", bytes);
    soup_session_send_and_read(session, msg, NULL, NULL);
    g_bytes_unref(bytes); g_free(auth);
    g_object_unref(msg); g_object_unref(session);
}

void room_ops_leave(MatrixClient *client, const char *room_id, const char *token) {
    do_room_request(client, "POST", room_id, "leave", "{}", token);
}

void room_ops_invite(MatrixClient *client, const char *room_id, const char *user_id, const char *token) {
    char *body = g_strdup_printf("{\"user_id\":\"%s\"}", user_id);
    do_room_request(client, "POST", room_id, "invite", body, token);
    g_free(body);
}

void room_ops_kick(MatrixClient *client, const char *room_id, const char *user_id,
                    const char *reason, const char *token) {
    char *body = reason ?
        g_strdup_printf("{\"user_id\":\"%s\",\"reason\":\"%s\"}", user_id, reason) :
        g_strdup_printf("{\"user_id\":\"%s\"}", user_id);
    do_room_request(client, "POST", room_id, "kick", body, token);
    g_free(body);
}

void room_ops_ban(MatrixClient *client, const char *room_id, const char *user_id,
                   const char *reason, const char *token) {
    char *body = reason ?
        g_strdup_printf("{\"user_id\":\"%s\",\"reason\":\"%s\"}", user_id, reason) :
        g_strdup_printf("{\"user_id\":\"%s\"}", user_id);
    do_room_request(client, "POST", room_id, "ban", body, token);
    g_free(body);
}

void room_ops_set_name(MatrixClient *client, const char *room_id, const char *name, const char *token) {
    char *body = g_strdup_printf("{\"name\":\"%s\"}", name);
    do_room_request(client, "PUT", room_id, "state/m.room.name/", body, token);
    g_free(body);
}

void room_ops_set_topic(MatrixClient *client, const char *room_id, const char *topic, const char *token) {
    char *body = g_strdup_printf("{\"topic\":\"%s\"}", topic);
    do_room_request(client, "PUT", room_id, "state/m.room.topic/", body, token);
    g_free(body);
}

char *room_ops_create(MatrixClient *client, const char *name, const char *preset, const char *token) {
    extern const char *matrix_client_get_base_url(MatrixClient *c);
    const char *base_url = matrix_client_get_base_url(client);
    char *url = g_strdup_printf("%s/_matrix/client/v3/createRoom", base_url);
    char *body = g_strdup_printf("{\"name\":\"%s\",\"preset\":\"%s\"}", name, preset);

    SoupSession *session = soup_session_new();
    SoupMessage *msg = soup_message_new("POST", url);
    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    GBytes *bytes = g_bytes_new(body, strlen(body));
    soup_message_set_request_body_from_bytes(msg, "application/json", bytes);

    GBytes *resp = soup_session_send_and_read(session, msg, NULL, NULL);
    char *room_id = NULL;
    if (resp) {
        gsize size;
        const char *data = g_bytes_get_data(resp, &size);
        JsonParser *parser = json_parser_new();
        if (json_parser_load_from_data(parser, data, size, NULL)) {
            JsonObject *obj = json_node_get_object(json_parser_get_root(parser));
            if (json_object_has_member(obj, "room_id"))
                room_id = g_strdup(json_object_get_string_member(obj, "room_id"));
        }
        g_object_unref(parser);
        g_bytes_unref(resp);
    }

    g_bytes_unref(bytes); g_free(auth); g_free(body); g_free(url);
    g_object_unref(msg); g_object_unref(session);
    return room_id;
}

/* Accessor for base_url */
const char *matrix_client_get_base_url(MatrixClient *c) {
    /* Access internal struct — in production use proper accessor */
    struct _MatrixClient { char *base_url; void *session; };
    return ((struct _MatrixClient *)c)->base_url;
}
