/**
 * Profile window — view/edit display name, avatar, storage.
 */

#include <gtk/gtk.h>
#include "../data/secure_storage.h"

extern void *meshlink_app_get(void);

void profile_window_show(GtkWindow *parent) {
    GtkWidget *win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(win), "Profile");
    gtk_window_set_default_size(GTK_WINDOW(win), 400, 500);
    gtk_window_set_transient_for(GTK_WINDOW(win), parent);
    gtk_window_set_modal(GTK_WINDOW(win), TRUE);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 12);
    gtk_widget_set_margin_start(box, 24);
    gtk_widget_set_margin_end(box, 24);
    gtk_widget_set_margin_top(box, 24);

    /* Avatar */
    GtkWidget *avatar_frame = gtk_frame_new(NULL);
    gtk_widget_set_size_request(avatar_frame, 80, 80);
    gtk_widget_set_halign(avatar_frame, GTK_ALIGN_CENTER);
    GtkWidget *avatar_label = gtk_label_new("AD");
    gtk_frame_set_child(GTK_FRAME(avatar_frame), avatar_label);
    gtk_box_append(GTK_BOX(box), avatar_frame);

    /* Name */
    GtkWidget *name_label = gtk_label_new("Admin");
    gtk_box_append(GTK_BOX(box), name_label);

    /* User ID */
    GtkWidget *uid_label = gtk_label_new("@admin:server");
    gtk_box_append(GTK_BOX(box), uid_label);

    /* Edit name */
    GtkWidget *name_entry = gtk_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(name_entry), "Display name");
    gtk_box_append(GTK_BOX(box), name_entry);

    GtkWidget *save_btn = gtk_button_new_with_label("Save");
    gtk_widget_add_css_class(save_btn, "suggested-action");
    gtk_box_append(GTK_BOX(box), save_btn);

    /* Storage */
    GtkWidget *storage_label = gtk_label_new("Cache: calculating...");
    gtk_widget_set_margin_top(storage_label, 24);
    gtk_box_append(GTK_BOX(box), storage_label);

    GtkWidget *clear_btn = gtk_button_new_with_label("Clear Cache");
    gtk_widget_add_css_class(clear_btn, "destructive-action");
    gtk_box_append(GTK_BOX(box), clear_btn);

    /* Logout */
    GtkWidget *logout_btn = gtk_button_new_with_label("Log Out");
    gtk_widget_add_css_class(logout_btn, "destructive-action");
    gtk_widget_set_margin_top(logout_btn, 24);
    gtk_box_append(GTK_BOX(box), logout_btn);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
