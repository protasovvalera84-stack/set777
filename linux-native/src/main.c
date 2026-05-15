/**
 * Meshlink Linux — GTK4 native desktop application.
 * Entry point. Initializes app and shows login or main window.
 */

#include <gtk/gtk.h>
#include "network/matrix_client.h"
#include "data/database.h"
#include "data/secure_storage.h"
#include "ui/login_window.h"
#include "ui/main_window.h"

typedef struct {
    GtkApplication *app;
    MatrixClient *client;
    MeshlinkDB *db;
    SecureStorage *storage;
} MeshlinkApp;

static MeshlinkApp *global_app = NULL;

MeshlinkApp *meshlink_app_get(void) { return global_app; }

static void on_activate(GtkApplication *app, gpointer user_data) {
    MeshlinkApp *mapp = (MeshlinkApp *)user_data;

    // Initialize services
    mapp->storage = secure_storage_new();
    mapp->db = meshlink_db_new();

    const char *server_url = secure_storage_get(mapp->storage, "server_url");
    if (!server_url) server_url = "https://72-56-244-207.nip.io";
    mapp->client = matrix_client_new(server_url);

    // Check if logged in
    const char *token = secure_storage_get(mapp->storage, "access_token");
    if (token) {
        main_window_show(app, mapp);
    } else {
        login_window_show(app, mapp);
    }
}

int main(int argc, char *argv[]) {
    MeshlinkApp *mapp = g_new0(MeshlinkApp, 1);
    global_app = mapp;

    mapp->app = gtk_application_new("io.meshlink.app", G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(mapp->app, "activate", G_CALLBACK(on_activate), mapp);

    int status = g_application_run(G_APPLICATION(mapp->app), argc, argv);

    // Cleanup
    if (mapp->client) matrix_client_free(mapp->client);
    if (mapp->db) meshlink_db_free(mapp->db);
    if (mapp->storage) secure_storage_free(mapp->storage);
    g_object_unref(mapp->app);
    g_free(mapp);

    return status;
}
