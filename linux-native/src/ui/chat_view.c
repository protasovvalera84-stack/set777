#include "chat_view.h"

GtkWidget *chat_view_new(void) {
    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);

    /* Header */
    GtkWidget *header = gtk_label_new("Select a chat");
    gtk_widget_set_margin_start(header, 16);
    gtk_widget_set_margin_top(header, 16);
    gtk_widget_set_halign(header, GTK_ALIGN_START);
    gtk_box_append(GTK_BOX(box), header);

    /* Messages */
    GtkWidget *msg_list = gtk_list_box_new();
    gtk_widget_set_vexpand(msg_list, TRUE);
    GtkWidget *scroll = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scroll), msg_list);
    gtk_box_append(GTK_BOX(box), scroll);

    /* Input */
    GtkWidget *input_box = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
    gtk_widget_set_margin_start(input_box, 8);
    gtk_widget_set_margin_end(input_box, 8);
    gtk_widget_set_margin_top(input_box, 8);
    gtk_widget_set_margin_bottom(input_box, 8);

    GtkWidget *entry = gtk_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(entry), "Message...");
    gtk_widget_set_hexpand(entry, TRUE);
    gtk_box_append(GTK_BOX(input_box), entry);

    GtkWidget *btn_send = gtk_button_new_with_label("Send");
    gtk_widget_add_css_class(btn_send, "suggested-action");
    gtk_box_append(GTK_BOX(input_box), btn_send);

    gtk_box_append(GTK_BOX(box), input_box);

    return box;
}
