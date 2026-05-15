#include "main_window.h"
#include "chat_view.h"

void main_window_show(GtkApplication *app, gpointer user_data) {
    GtkWidget *win = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(win), "Meshlink");
    gtk_window_set_default_size(GTK_WINDOW(win), 900, 650);

    GtkWidget *paned = gtk_paned_new(GTK_ORIENTATION_HORIZONTAL);
    gtk_paned_set_position(GTK_PANED(paned), 320);

    /* Left: room list */
    GtkWidget *left_box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
    GtkWidget *header = gtk_label_new("Meshlink");
    gtk_widget_set_margin_start(header, 16);
    gtk_widget_set_margin_top(header, 12);
    gtk_widget_set_halign(header, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(left_box), header);

    GtkWidget *search = gtk_search_entry_new();
    gtk_widget_set_margin_start(search, 12);
    gtk_widget_set_margin_end(search, 12);
    gtk_widget_set_margin_top(search, 8);
    gtk_box_append(GTK_BOX(left_box), search);

    GtkWidget *room_list = gtk_list_box_new();
    gtk_widget_set_vexpand(room_list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), room_list);
    gtk_box_append(GTK_BOX(left_box), scroll);

    gtk_paned_set_start_child(GTK_PANED(paned), left_box);

    /* Right: chat view */
    GtkWidget *chat = chat_view_new();
    gtk_paned_set_end_child(GTK_PANED(paned), chat);

    gtk_window_set_child(GTK_WINDOW(win), paned);
    gtk_window_present(GTK_WINDOW(win));
}
