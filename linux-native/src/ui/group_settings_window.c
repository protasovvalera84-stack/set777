/**
 * Group settings window — members, invite, kick, rename, leave.
 */

#include <gtk/gtk.h>
#include <libsoup/soup.h>
#include <json-glib/json-glib.h>
#include "../network/matrix_client.h"
#include "../data/database.h"
#include "../data/secure_storage.h"
#include <string.h>

extern void *meshlink_app_get(void);

typedef struct {
    GtkWidget *win;
    GtkWidget *name_label;
    GtkWidget *name_entry;
    GtkWidget *member_list;
    GtkWidget *member_count;
    char *room_id;
    MatrixClient *client;
    SecureStorage *storage;
} GroupSettingsData;

static void on_save_name(GtkButton *btn, GroupSettingsData *data) {
    const char *token = secure_storage_get(data->storage, "access_token");
    const char *server = secure_storage_get(data->storage, "server_url");
    if (!token || !server) return;

    GtkEntryBuffer *buf = gtk_entry_get_buffer(GTK_ENTRY(data->name_entry));
    const char *new_name = gtk_entry_buffer_get_text(buf);
    if (!new_name || strlen(new_name) == 0) return;

    /* Send rename request */
    char *encoded = g_uri_escape_string(data->room_id, NULL, TRUE);
    char *path = g_strdup_printf("/_matrix/client/v3/rooms/%s/state/m.room.name/", encoded);
    char *body = g_strdup_printf("{\"name\":\"%s\"}", new_name);

    /* Using libsoup directly for simplicity */
    SoupSession *session = soup_session_new();
    char *url = g_strdup_printf("%s%s", server, path);
    SoupMessage *msg = soup_message_new("PUT", url);
    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    GBytes *bytes = g_bytes_new(body, strlen(body));
    soup_message_set_request_body_from_bytes(msg, "application/json", bytes);
    soup_session_send_and_read(session, msg, NULL, NULL);

    gtk_label_set_text(GTK_LABEL(data->name_label), new_name);

    g_bytes_unref(bytes);
    g_object_unref(msg);
    g_object_unref(session);
    g_free(url); g_free(auth); g_free(body); g_free(path); g_free(encoded);
}

static void on_invite(GtkButton *btn, GroupSettingsData *data) {
    GtkWidget *dialog = gtk_dialog_new_with_buttons("Invite User",
        GTK_WINDOW(data->win), GTK_DIALOG_MODAL | GTK_DIALOG_DESTROY_WITH_PARENT,
        "Invite", GTK_RESPONSE_OK, "Cancel", GTK_RESPONSE_CANCEL, NULL);

    GtkWidget *content = gtk_dialog_get_content_area(GTK_DIALOG(dialog));
    GtkWidget *entry = gtk_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(entry), "@user:server");
    gtk_box_append(GTK_BOX(content), entry);
    gtk_widget_set_margin_start(entry, 16);
    gtk_widget_set_margin_end(entry, 16);
    gtk_widget_set_margin_top(entry, 16);

    /* TODO: handle response and send invite */
    gtk_window_present(GTK_WINDOW(dialog));
}

static void on_leave(GtkButton *btn, GroupSettingsData *data) {
    const char *token = secure_storage_get(data->storage, "access_token");
    const char *server = secure_storage_get(data->storage, "server_url");
    if (!token || !server) return;

    char *encoded = g_uri_escape_string(data->room_id, NULL, TRUE);
    char *url = g_strdup_printf("%s/_matrix/client/v3/rooms/%s/leave", server, encoded);

    SoupSession *session = soup_session_new();
    SoupMessage *msg = soup_message_new("POST", url);
    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    GBytes *bytes = g_bytes_new("{}", 2);
    soup_message_set_request_body_from_bytes(msg, "application/json", bytes);
    soup_session_send_and_read(session, msg, NULL, NULL);

    g_bytes_unref(bytes);
    g_object_unref(msg);
    g_object_unref(session);
    g_free(url); g_free(auth); g_free(encoded);

    gtk_window_close(GTK_WINDOW(data->win));
}

void group_settings_window_show(GtkWindow *parent, const char *room_id, const char *room_name,
                                 MatrixClient *client, SecureStorage *storage) {
    GroupSettingsData *data = g_new0(GroupSettingsData, 1);
    data->room_id = g_strdup(room_id);
    data->client = client;
    data->storage = storage;

    data->win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(data->win), "Group Settings");
    gtk_window_set_default_size(GTK_WINDOW(data->win), 420, 550);
    gtk_window_set_transient_for(GTK_WINDOW(data->win), parent);
    gtk_window_set_modal(GTK_WINDOW(data->win), TRUE);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_widget_set_margin_start(box, 24);
    gtk_widget_set_margin_end(box, 24);
    gtk_widget_set_margin_top(box, 24);

    /* Group name */
    data->name_label = gtk_label_new(room_name);
    gtk_box_append(GTK_BOX(box), data->name_label);

    data->name_entry = gtk_entry_new();
    GtkEntryBuffer *buf = gtk_entry_get_buffer(GTK_ENTRY(data->name_entry));
    gtk_entry_buffer_set_text(buf, room_name, -1);
    gtk_box_append(GTK_BOX(box), data->name_entry);

    GtkWidget *save_btn = gtk_button_new_with_label("Save Name");
    gtk_widget_add_css_class(save_btn, "suggested-action");
    g_signal_connect(save_btn, "clicked", G_CALLBACK(on_save_name), data);
    gtk_box_append(GTK_BOX(box), save_btn);

    /* Members */
    data->member_count = gtk_label_new("Members");
    gtk_widget_set_margin_top(data->member_count, 16);
    gtk_widget_set_halign(data->member_count, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), data->member_count);

    GtkWidget *invite_btn = gtk_button_new_with_label("Invite User");
    g_signal_connect(invite_btn, "clicked", G_CALLBACK(on_invite), data);
    gtk_box_append(GTK_BOX(box), invite_btn);

    data->member_list = gtk_list_box_new();
    gtk_widget_set_vexpand(data->member_list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), data->member_list);
    gtk_box_append(GTK_BOX(box), scroll);

    /* Leave */
    GtkWidget *leave_btn = gtk_button_new_with_label("Leave Group");
    gtk_widget_add_css_class(leave_btn, "destructive-action");
    gtk_widget_set_margin_top(leave_btn, 16);
    g_signal_connect(leave_btn, "clicked", G_CALLBACK(on_leave), data);
    gtk_box_append(GTK_BOX(box), leave_btn);

    gtk_window_set_child(GTK_WINDOW(data->win), box);
    gtk_window_present(GTK_WINDOW(data->win));
}
