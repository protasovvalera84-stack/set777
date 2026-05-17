/**
 * Desktop notifications using libnotify.
 * Also handles connection status monitoring.
 */

#include <glib.h>
#include <glib/gstdio.h>
#include <gio/gio.h>
#include <sys/stat.h>

typedef struct {
    GApplication *app;
    gboolean enabled;
} NotificationService;

NotificationService *notification_service_new(GApplication *app) {
    NotificationService *ns = g_new0(NotificationService, 1);
    ns->app = app;
    ns->enabled = TRUE;
    return ns;
}

void notification_service_show(NotificationService *ns, const char *title, const char *body) {
    if (!ns || !ns->enabled) return;

    GNotification *notif = g_notification_new(title);
    g_notification_set_body(notif, body);
    g_notification_set_priority(notif, G_NOTIFICATION_PRIORITY_HIGH);
    g_application_send_notification(ns->app, NULL, notif);
    g_object_unref(notif);
}

void notification_service_set_enabled(NotificationService *ns, gboolean enabled) {
    if (ns) ns->enabled = enabled;
}

void notification_service_free(NotificationService *ns) {
    g_free(ns);
}

/**
 * Connection monitor — checks network status.
 */
typedef struct {
    GNetworkMonitor *monitor;
    gboolean is_online;
    void (*on_changed)(gboolean online, gpointer data);
    gpointer callback_data;
} ConnectionMonitor;

static void on_network_changed(GNetworkMonitor *monitor, gboolean available, ConnectionMonitor *cm) {
    cm->is_online = available;
    if (cm->on_changed) cm->on_changed(available, cm->callback_data);
}

ConnectionMonitor *connection_monitor_new(void) {
    ConnectionMonitor *cm = g_new0(ConnectionMonitor, 1);
    cm->monitor = g_network_monitor_get_default();
    cm->is_online = g_network_monitor_get_network_available(cm->monitor);
    g_signal_connect(cm->monitor, "network-changed", G_CALLBACK(on_network_changed), cm);
    return cm;
}

gboolean connection_monitor_is_online(ConnectionMonitor *cm) {
    return cm ? cm->is_online : FALSE;
}

void connection_monitor_set_callback(ConnectionMonitor *cm,
    void (*cb)(gboolean, gpointer), gpointer data) {
    if (cm) { cm->on_changed = cb; cm->callback_data = data; }
}

void connection_monitor_free(ConnectionMonitor *cm) {
    g_free(cm);
}

/**
 * App data manager — storage stats, cleanup.
 */
gint64 app_data_get_size(void) {
    char *dir = g_build_filename(g_get_user_data_dir(), "meshlink", NULL);
    gint64 total = 0;
    GDir *d = g_dir_open(dir, 0, NULL);
    if (d) {
        const char *name;
        while ((name = g_dir_read_name(d))) {
            char *path = g_build_filename(dir, name, NULL);
            struct stat st;
            if (g_stat(path, &st) == 0) total += st.st_size;
            g_free(path);
        }
        g_dir_close(d);
    }
    g_free(dir);
    return total;
}

void app_data_clear(void) {
    char *media_dir = g_build_filename(g_get_user_data_dir(), "meshlink", ".media", NULL);
    GDir *d = g_dir_open(media_dir, 0, NULL);
    if (d) {
        const char *name;
        while ((name = g_dir_read_name(d))) {
            char *path = g_build_filename(media_dir, name, NULL);
            g_remove(path); g_free(path);
        }
        g_dir_close(d);
    }
    g_free(media_dir);
}

char *app_data_format_size(gint64 bytes) {
    if (bytes < 1024) return g_strdup_printf("%ld B", (long)bytes);
    if (bytes < 1024*1024) return g_strdup_printf("%ld KB", (long)(bytes/1024));
    if (bytes < 1024L*1024*1024) return g_strdup_printf("%ld MB", (long)(bytes/(1024*1024)));
    return g_strdup_printf("%.1f GB", (double)bytes/(1024.0*1024*1024));
}
