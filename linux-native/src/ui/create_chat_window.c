/**
 * Create chat window — search users, create DM or group.
 */

#include <gtk/gtk.h>

void create_chat_window_show(GtkWindow *parent) {
    GtkWidget *win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(win), "New Chat");
    gtk_window_set_default_size(GTK_WINDOW(win), 400, 450);
    gtk_window_set_transient_for(GTK_WINDOW(win), parent);
    gtk_window_set_modal(GTK_WINDOW(win), TRUE);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_widget_set_margin_start(box, 16);
    gtk_widget_set_margin_end(box, 16);
    gtk_widget_set_margin_top(box, 16);

    /* Search */
    GtkWidget *search = gtk_search_entry_new();
    gtk_search_entry_set_placeholder_text(GTK_SEARCH_ENTRY(search), "Search users...");
    gtk_box_append(GTK_BOX(box), search);

    /* Create group button */
    GtkWidget *group_btn = gtk_button_new_with_label("Create Group");
    gtk_box_append(GTK_BOX(box), group_btn);

    /* Results */
    GtkWidget *list = gtk_list_box_new();
    gtk_widget_set_vexpand(list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), list);
    gtk_box_append(GTK_BOX(box), scroll);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
