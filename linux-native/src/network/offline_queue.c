/**
 * Offline queue — stores messages when no connection.
 * Persists to file, flushes when connection restored.
 */

#include <glib.h>
#include <json-glib/json-glib.h>
#include <string.h>
#include "matrix_client.h"

typedef struct {
    char *room_id;
    char *body;
    char *msgtype;
    gint64 timestamp;
    int retries;
} QueuedMessage;

typedef struct {
    GList *queue;
    char *queue_path;
} OfflineQueue;

/* Forward declaration */
void offline_queue_save(OfflineQueue *q);

OfflineQueue *offline_queue_new(void) {
    OfflineQueue *q = g_new0(OfflineQueue, 1);
    q->queue_path = g_build_filename(g_get_user_data_dir(), "meshlink", "offline_queue.json", NULL);
    q->queue = NULL;

    /* Load from file */
    if (g_file_test(q->queue_path, G_FILE_TEST_EXISTS)) {
        char *contents = NULL;
        if (g_file_get_contents(q->queue_path, &contents, NULL, NULL)) {
            JsonParser *parser = json_parser_new();
            if (json_parser_load_from_data(parser, contents, -1, NULL)) {
                JsonArray *arr = json_node_get_array(json_parser_get_root(parser));
                for (guint i = 0; i < json_array_get_length(arr); i++) {
                    JsonObject *obj = json_array_get_object_element(arr, i);
                    QueuedMessage *msg = g_new0(QueuedMessage, 1);
                    msg->room_id = g_strdup(json_object_get_string_member(obj, "room_id"));
                    msg->body = g_strdup(json_object_get_string_member(obj, "body"));
                    msg->msgtype = g_strdup(json_object_get_string_member_with_default(obj, "msgtype", "m.text"));
                    msg->timestamp = json_object_get_int_member(obj, "timestamp");
                    msg->retries = json_object_get_int_member(obj, "retries");
                    q->queue = g_list_append(q->queue, msg);
                }
            }
            g_object_unref(parser);
            g_free(contents);
        }
    }
    return q;
}

void offline_queue_enqueue(OfflineQueue *q, const char *room_id, const char *body) {
    QueuedMessage *msg = g_new0(QueuedMessage, 1);
    msg->room_id = g_strdup(room_id);
    msg->body = g_strdup(body);
    msg->msgtype = g_strdup("m.text");
    msg->timestamp = g_get_real_time() / 1000;
    msg->retries = 0;
    q->queue = g_list_append(q->queue, msg);
    /* Save to file */
    offline_queue_save(q);
}

int offline_queue_flush(OfflineQueue *q, MatrixClient *client, const char *token) {
    int sent = 0;
    GList *to_remove = NULL;

    for (GList *l = q->queue; l; l = l->next) {
        QueuedMessage *msg = l->data;
        char *event_id = matrix_client_send_message(client, msg->room_id, msg->body, token);
        if (event_id) {
            to_remove = g_list_append(to_remove, msg);
            sent++;
            g_free(event_id);
        } else {
            msg->retries++;
            if (msg->retries > 10) to_remove = g_list_append(to_remove, msg);
        }
    }

    for (GList *l = to_remove; l; l = l->next) {
        q->queue = g_list_remove(q->queue, l->data);
        QueuedMessage *msg = l->data;
        g_free(msg->room_id); g_free(msg->body); g_free(msg->msgtype); g_free(msg);
    }
    g_list_free(to_remove);
    offline_queue_save(q);
    return sent;
}

int offline_queue_count(OfflineQueue *q) {
    return g_list_length(q->queue);
}

void offline_queue_save(OfflineQueue *q) {
    JsonBuilder *builder = json_builder_new();
    json_builder_begin_array(builder);
    for (GList *l = q->queue; l; l = l->next) {
        QueuedMessage *msg = l->data;
        json_builder_begin_object(builder);
        json_builder_set_member_name(builder, "room_id");
        json_builder_add_string_value(builder, msg->room_id);
        json_builder_set_member_name(builder, "body");
        json_builder_add_string_value(builder, msg->body);
        json_builder_set_member_name(builder, "msgtype");
        json_builder_add_string_value(builder, msg->msgtype);
        json_builder_set_member_name(builder, "timestamp");
        json_builder_add_int_value(builder, msg->timestamp);
        json_builder_set_member_name(builder, "retries");
        json_builder_add_int_value(builder, msg->retries);
        json_builder_end_object(builder);
    }
    json_builder_end_array(builder);

    JsonGenerator *gen = json_generator_new();
    json_generator_set_root(gen, json_builder_get_root(builder));
    char *json = json_generator_to_data(gen, NULL);
    g_mkdir_with_parents(g_path_get_dirname(q->queue_path), 0700);
    g_file_set_contents(q->queue_path, json, -1, NULL);
    g_free(json);
    g_object_unref(gen);
    g_object_unref(builder);
}

void offline_queue_free(OfflineQueue *q) {
    if (!q) return;
    for (GList *l = q->queue; l; l = l->next) {
        QueuedMessage *msg = l->data;
        g_free(msg->room_id); g_free(msg->body); g_free(msg->msgtype); g_free(msg);
    }
    g_list_free(q->queue);
    g_free(q->queue_path);
    g_free(q);
}
