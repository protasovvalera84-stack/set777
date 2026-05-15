/**
 * Settings window — notifications, theme, server info, clear data.
 */

#include <gtk/gtk.h>

void settings_window_show(GtkWindow *parent) {
    GtkWidget *win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(win), "Settings");
    gtk_window_set_default_size(GTK_WINDOW(win), 400, 450);
    gtk_window_set_transient_for(GTK_WINDOW(win), parent);
    gtk_window_set_modal(GTK_WINDOW(win), TRUE);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_widget_set_margin_start(box, 24);
    gtk_widget_set_margin_end(box, 24);
    gtk_widget_set_margin_top(box, 24);

    /* Notifications */
    GtkWidget *notif_label = gtk_label_new("Notifications");
    gtk_widget_set_halign(notif_label, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), notif_label);

    GtkWidget *notif_switch = gtk_switch_new();
    gtk_switch_set_active(GTK_SWITCH(notif_switch), TRUE);
    gtk_widget_set_halign(notif_switch, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), notif_switch);

    /* Theme */
    GtkWidget *theme_label = gtk_label_new("Dark Mode");
    gtk_widget_set_halign(theme_label, GTK_ALIGN_START);
    gtk_widget_set_margin_top(theme_label, 16);
    gtk_box_append(GTK_BOX(box), theme_label);

    GtkWidget *theme_switch = gtk_switch_new();
    gtk_switch_set_active(GTK_SWITCH(theme_switch), TRUE);
    gtk_widget_set_halign(theme_switch, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), theme_switch);

    /* Server info */
    GtkWidget *server_label = gtk_label_new("Server");
    gtk_widget_set_halign(server_label, GTK_ALIGN_START);
    gtk_widget_set_margin_top(server_label, 16);
    gtk_box_append(GTK_BOX(box), server_label);

    GtkWidget *server_url = gtk_label_new("https://72-56-244-207.nip.io");
    gtk_widget_set_halign(server_url, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), server_url);

    /* Version */
    GtkWidget *version_label = gtk_label_new("Meshlink v1.0.0 (Linux GTK4)");
    gtk_widget_set_halign(version_label, GTK_ALIGN_START);
    gtk_widget_set_margin_top(version_label, 16);
    gtk_box_append(GTK_BOX(box), version_label);

    /* Clear data */
    GtkWidget *clear_btn = gtk_button_new_with_label("Clear All Data");
    gtk_widget_add_css_class(clear_btn, "destructive-action");
    gtk_widget_set_margin_top(clear_btn, 24);
    gtk_box_append(GTK_BOX(box), clear_btn);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
