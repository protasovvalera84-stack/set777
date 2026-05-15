#include "secure_storage.h"
#include <libsecret/secret.h>
#include <string.h>

struct _SecureStorage { GHashTable *cache; };

SecureStorage *secure_storage_new(void) {
    SecureStorage *s = g_new0(SecureStorage, 1);
    s->cache = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, g_free);
    return s;
}

void secure_storage_free(SecureStorage *s) {
    if (s) { g_hash_table_destroy(s->cache); g_free(s); }
}

void secure_storage_set(SecureStorage *s, const char *key, const char *value) {
    g_hash_table_replace(s->cache, g_strdup(key), g_strdup(value));
    /* In production: use libsecret to store in GNOME Keyring */
    char *path = g_build_filename(g_get_user_data_dir(), "meshlink", ".secure", key, NULL);
    g_mkdir_with_parents(g_path_get_dirname(path), 0700);
    g_file_set_contents(path, value, -1, NULL);
    g_free(path);
}

const char *secure_storage_get(SecureStorage *s, const char *key) {
    const char *cached = g_hash_table_lookup(s->cache, key);
    if (cached) return cached;
    char *path = g_build_filename(g_get_user_data_dir(), "meshlink", ".secure", key, NULL);
    char *value = NULL;
    if (g_file_get_contents(path, &value, NULL, NULL)) {
        g_hash_table_replace(s->cache, g_strdup(key), value);
        g_free(path);
        return g_hash_table_lookup(s->cache, key);
    }
    g_free(path);
    return NULL;
}

void secure_storage_clear(SecureStorage *s) {
    g_hash_table_remove_all(s->cache);
    char *dir = g_build_filename(g_get_user_data_dir(), "meshlink", ".secure", NULL);
    /* Remove all files in secure dir */
    GDir *d = g_dir_open(dir, 0, NULL);
    if (d) {
        const char *name;
        while ((name = g_dir_read_name(d))) {
            char *p = g_build_filename(dir, name, NULL);
            g_remove(p); g_free(p);
        }
        g_dir_close(d);
    }
    g_free(dir);
}
