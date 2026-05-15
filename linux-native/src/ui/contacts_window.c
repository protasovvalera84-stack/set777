/**
 * Contacts window — friends list, add/remove friends.
 */

#include <gtk/gtk.h>

void contacts_window_show(GtkWindow *parent) {
    GtkWidget *win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(win), "Friends");
    gtk_window_set_default_size(GTK_WINDOW(win), 400, 500);
    gtk_window_set_transient_for(GTK_WINDOW(win), parent);
    gtk_window_set_modal(GTK_WINDOW(win), TRUE);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_widget_set_margin_start(box, 16);
    gtk_widget_set_margin_end(box, 16);
    gtk_widget_set_margin_top(box, 16);

    /* Search */
    GtkWidget *search = gtk_search_entry_new();
    gtk_box_append(GTK_BOX(box), search);

    /* Friends list */
    GtkWidget *list = gtk_list_box_new();
    gtk_widget_set_vexpand(list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), list);
    gtk_box_append(GTK_BOX(box), scroll);

    /* Empty state */
    GtkWidget *empty = gtk_label_new("No friends yet\nSearch users to add friends");
    gtk_widget_set_halign(empty, GTK_ALIGN_CENTER);
    gtk_widget_set_valign(empty, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(box), empty);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
