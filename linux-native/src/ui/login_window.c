#include "login_window.h"
#include <string.h>

void login_window_show(GtkApplication *app, gpointer user_data) {
    (void)user_data; /* unused */
    GtkWidget *win = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(win), "Meshlink");
    gtk_window_set_default_size(GTK_WINDOW(win), 400, 500);

    GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 12);
    gtk_widget_set_margin_start(box, 40);
    gtk_widget_set_margin_end(box, 40);
    gtk_widget_set_margin_top(box, 60);
    gtk_widget_set_valign(box, GTK_ALIGN_CENTER);

    GtkWidget *title = gtk_label_new("Meshlink");
    gtk_box_append(GTK_BOX(box), title);

    GtkWidget *subtitle = gtk_label_new("Encrypted Messenger");
    gtk_box_append(GTK_BOX(box), subtitle);

    GtkWidget *entry_server = gtk_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(entry_server), "Server URL");
    gtk_box_append(GTK_BOX(box), entry_server);

    GtkWidget *entry_user = gtk_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(entry_user), "Username");
    gtk_box_append(GTK_BOX(box), entry_user);

    GtkWidget *entry_pass = gtk_password_entry_new();
    gtk_password_entry_set_show_peek_icon(GTK_PASSWORD_ENTRY(entry_pass), TRUE);
    gtk_box_append(GTK_BOX(box), entry_pass);

    GtkWidget *btn_login = gtk_button_new_with_label("Login");
    gtk_widget_add_css_class(btn_login, "suggested-action");
    gtk_box_append(GTK_BOX(box), btn_login);

    GtkWidget *btn_register = gtk_button_new_with_label("Create Account");
    gtk_box_append(GTK_BOX(box), btn_register);

    gtk_window_set_child(GTK_WINDOW(win), box);
    gtk_window_present(GTK_WINDOW(win));
}
