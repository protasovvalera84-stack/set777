/**
 * Content window — reusable for Shorts, Video, Music, Marketplace.
 */

#include <gtk/gtk.h>

typedef enum {
    CONTENT_SHORTS,
    CONTENT_VIDEO,
    CONTENT_MUSIC,
    CONTENT_MARKETPLACE
} ContentType;

void content_window_show(GtkWindow *parent, ContentType type) {
    const char *title = "Content";
    switch (type) {
        case CONTENT_SHORTS: title = "Shorts"; break;
        case CONTENT_VIDEO: title = "Video"; break;
        case CONTENT_MUSIC: title = "Music"; break;
        case CONTENT_MARKETPLACE: title = "Marketplace"; break;
    }

    GtkWidget *win = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(win), title);
    gtk_window_set_default_size(GTK_WINDOW(win), 600, 500);
    gtk_window_set_transient_for(GTK_WINDOW(win), parent);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);

    /* Header */
    GtkWidget *header = gtk_label_new(title);
    gtk_widget_set_margin_start(header, 16);
    gtk_widget_set_margin_top(header, 16);
    gtk_widget_set_halign(header, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), header);

    /* Content list */
    GtkWidget *list = gtk_list_box_new();
    gtk_widget_set_vexpand(list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), list);
    gtk_box_append(GTK_BOX(box), scroll);

    /* Empty state */
    const char *empty_text = "No content yet";
    switch (type) {
        case CONTENT_SHORTS: empty_text = "No shorts yet. Upload from mobile!"; break;
        case CONTENT_VIDEO: empty_text = "No videos yet"; break;
        case CONTENT_MUSIC: empty_text = "No music yet"; break;
        case CONTENT_MARKETPLACE: empty_text = "No listings yet"; break;
    }
    GtkWidget *empty = gtk_label_new(empty_text);
    gtk_widget_set_halign(empty, GTK_ALIGN_CENTER);
    gtk_widget_set_valign(empty, GTK_ALIGN_CENTER);
    gtk_box_append(GTK_BOX(box), empty);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
