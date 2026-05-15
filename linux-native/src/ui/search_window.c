/**
 * Search window — search rooms, messages, users.
 */

#include <gtk/gtk.h>
#include "../network/matrix_client.h"
#include "../data/database.h"
#include "../data/secure_storage.h"
#include <string.h>

typedef struct {
    GtkWidget *win;
    GtkWidget *search_entry;
    GtkWidget *result_list;
    MatrixClient *client;
    MeshlinkDB *db;
    SecureStorage *storage;
} SearchData;

static void on_search_changed(GtkSearchEntry *entry, SearchData *data) {
    const char *query = gtk_editable_get_text(GTK_EDITABLE(entry));
    if (!query || strlen(query) < 2) return;

    /* Clear results */
    GtkWidget *child;
    while ((child = gtk_widget_get_first_child(data->result_list)))
        gtk_list_box_remove(GTK_LIST_BOX(data->result_list), child);

    /* Search rooms from local DB */
    GList *rooms = meshlink_db_get_rooms(data->db);
    char *q_lower = g_utf8_strdown(query, -1);

    for (GList *l = rooms; l; l = l->next) {
        DBRoom *room = l->data;
        char *name_lower = g_utf8_strdown(room->name, -1);
        if (strstr(name_lower, q_lower)) {
            GtkWidget *row = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
            gtk_widget_set_margin_start(row, 8);
            gtk_widget_set_margin_top(row, 4);
            gtk_widget_set_margin_bottom(row, 4);

            GtkWidget *icon = gtk_label_new("💬");
            gtk_box_append(GTK_BOX(row), icon);

            GtkWidget *info = gtk_box_new(GTK_ORIENTATION_VERTICAL, 2);
            GtkWidget *name = gtk_label_new(room->name);
            gtk_widget_set_halign(name, GTK_ALIGN_START);
            gtk_box_append(GTK_BOX(info), name);

            char *id_short = g_strndup(room->room_id, 20);
            GtkWidget *sub = gtk_label_new(id_short);
            gtk_widget_set_halign(sub, GTK_ALIGN_START);
            gtk_box_append(GTK_BOX(info), sub);
            g_free(id_short);

            gtk_box_append(GTK_BOX(row), info);
            gtk_list_box_append(GTK_LIST_BOX(data->result_list), row);
        }
        g_free(name_lower);
    }

    /* Search messages */
    for (GList *l = rooms; l; l = l->next) {
        DBRoom *room = l->data;
        GList *msgs = meshlink_db_get_messages(data->db, room->room_id, 50);
        for (GList *m = msgs; m; m = m->next) {
            DBMessage *msg = m->data;
            char *body_lower = g_utf8_strdown(msg->body, -1);
            if (strstr(body_lower, q_lower)) {
                GtkWidget *row = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
                gtk_widget_set_margin_start(row, 8);
                gtk_widget_set_margin_top(row, 4);

                GtkWidget *icon = gtk_label_new("📝");
                gtk_box_append(GTK_BOX(row), icon);

                int body_len = strlen(msg->body);
                char *truncated = body_len > 60 ? g_strndup(msg->body, 60) : g_strdup(msg->body);
                GtkWidget *text = gtk_label_new(truncated);
                gtk_widget_set_halign(text, GTK_ALIGN_START);
                gtk_label_set_ellipsize(GTK_LABEL(text), PANGO_ELLIPSIZE_END);
                gtk_box_append(GTK_BOX(row), text);
                g_free(truncated);

                gtk_list_box_append(GTK_LIST_BOX(data->result_list), row);
            }
            g_free(body_lower);
        }
        g_list_free_full(msgs, (GDestroyNotify)db_message_free);
    }

    /* Search users via Matrix API */
    const char *token = secure_storage_get(data->storage, "access_token");
    if (token) {
        GList *users = matrix_client_search_users(data->client, query, token, 5);
        for (GList *u = users; u; u = u->next) {
            UserSearchResult *usr = u->data;
            GtkWidget *row = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
            gtk_widget_set_margin_start(row, 8);
            gtk_widget_set_margin_top(row, 4);

            GtkWidget *icon = gtk_label_new("👤");
            gtk_box_append(GTK_BOX(row), icon);

            GtkWidget *info = gtk_box_new(GTK_ORIENTATION_VERTICAL, 2);
            GtkWidget *name = gtk_label_new(usr->display_name ? usr->display_name : usr->user_id);
            gtk_widget_set_halign(name, GTK_ALIGN_START);
            gtk_box_append(GTK_BOX(info), name);

            GtkWidget *uid = gtk_label_new(usr->user_id);
            gtk_widget_set_halign(uid, GTK_ALIGN_START);
            gtk_box_append(GTK_BOX(info), uid);

            gtk_box_append(GTK_BOX(row), info);
            gtk_list_box_append(GTK_LIST_BOX(data->result_list), row);
        }
        g_list_free_full(users, (GDestroyNotify)user_search_result_free);
    }

    g_free(q_lower);
    g_list_free_full(rooms, (GDestroyNotify)db_room_free);
}

void search_window_show(GtkWindow *parent, MatrixClient *client, MeshlinkDB *db, SecureStorage *storage) {
    SearchData *data = g_new0(SearchData, 1);
    data->client = client;
    data->db = db;
    data->storage = storage;

    data->win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(data->win), "Search");
    gtk_window_set_default_size(GTK_WINDOW(data->win), 500, 500);
    gtk_window_set_transient_for(GTK_WINDOW(data->win), parent);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_widget_set_margin_start(box, 16);
    gtk_widget_set_margin_end(box, 16);
    gtk_widget_set_margin_top(box, 16);

    data->search_entry = gtk_search_entry_new();
    g_signal_connect(data->search_entry, "search-changed", G_CALLBACK(on_search_changed), data);
    gtk_box_append(GTK_BOX(box), data->search_entry);

    data->result_list = gtk_list_box_new();
    gtk_widget_set_vexpand(data->result_list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), data->result_list);
    gtk_box_append(GTK_BOX(box), scroll);

    gtk_window_set_child(GTK_WINDOW(data->win), box);
    gtk_window_present(GTK_WINDOW(data->win));
}
