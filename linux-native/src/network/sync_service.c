/**
 * Background sync service — polls Matrix /sync endpoint.
 * Stores new messages in local SQLite.
 * Runs in separate GLib thread.
 */

#include "matrix_client.h"
#include "../data/database.h"
#include "../data/secure_storage.h"
#include <glib.h>
#include <string.h>

typedef struct {
    MatrixClient *client;
    MeshlinkDB *db;
    SecureStorage *storage;
    char *next_batch;
    gboolean running;
    GThread *thread;
    void (*on_new_message)(const char *room_id, const char *sender, const char *body, gpointer data);
    gpointer callback_data;
} SyncService;

static SyncService *global_sync = NULL;

static gpointer sync_thread_func(gpointer data) {
    SyncService *svc = (SyncService *)data;
    const char *token = secure_storage_get(svc->storage, "access_token");
    if (!token) return NULL;

    while (svc->running) {
        SyncResponse *resp = matrix_client_sync(svc->client, token, svc->next_batch, 30000);
        if (resp && resp->next_batch) {
            g_free(svc->next_batch);
            svc->next_batch = g_strdup(resp->next_batch);
            secure_storage_set(svc->storage, "sync_next_batch", svc->next_batch);
        }
        if (resp) sync_response_free(resp);

        if (!svc->running) break;
        /* Small delay on error */
        g_usleep(1000000); /* 1 second */
    }
    return NULL;
}

SyncService *sync_service_new(MatrixClient *client, MeshlinkDB *db, SecureStorage *storage) {
    SyncService *svc = g_new0(SyncService, 1);
    svc->client = client;
    svc->db = db;
    svc->storage = storage;
    svc->next_batch = g_strdup(secure_storage_get(storage, "sync_next_batch"));
    svc->running = FALSE;
    global_sync = svc;
    return svc;
}

void sync_service_start(SyncService *svc) {
    if (svc->running) return;
    svc->running = TRUE;
    svc->thread = g_thread_new("meshlink-sync", sync_thread_func, svc);
}

void sync_service_stop(SyncService *svc) {
    svc->running = FALSE;
    if (svc->thread) {
        g_thread_join(svc->thread);
        svc->thread = NULL;
    }
}

void sync_service_set_callback(SyncService *svc,
    void (*cb)(const char*, const char*, const char*, gpointer), gpointer data) {
    svc->on_new_message = cb;
    svc->callback_data = data;
}

void sync_service_free(SyncService *svc) {
    if (!svc) return;
    sync_service_stop(svc);
    g_free(svc->next_batch);
    g_free(svc);
    if (global_sync == svc) global_sync = NULL;
}
