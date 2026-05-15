#include <glib.h>
#include <string.h>

char *meshlink_format_size(gint64 bytes) {
    if (bytes < 1024) return g_strdup_printf("%ld B", (long)bytes);
    if (bytes < 1024*1024) return g_strdup_printf("%ld KB", (long)(bytes/1024));
    return g_strdup_printf("%ld MB", (long)(bytes/(1024*1024)));
}

char *meshlink_username(const char *user_id) {
    if (!user_id) return g_strdup("?");
    const char *colon = strchr(user_id, ':');
    if (!colon) return g_strdup(user_id);
    int len = (int)(colon - user_id);
    if (user_id[0] == '@') { user_id++; len--; }
    return g_strndup(user_id, len);
}

char *meshlink_initials(const char *name) {
    if (!name || strlen(name) < 2) return g_strdup("?");
    char buf[3] = { g_ascii_toupper(name[0]), g_ascii_toupper(name[1]), 0 };
    return g_strdup(buf);
}
