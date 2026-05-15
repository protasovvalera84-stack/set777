/**
 * Media cache — downloads and caches media files locally.
 * Files stored in ~/.local/share/meshlink/.media/
 */

#include <glib.h>
#include <gio/gio.h>
#include <libsoup/soup.h>
#include <string.h>
#include <stdio.h>

typedef struct {
    char *cache_dir;
    SoupSession *session;
} MediaCache;

MediaCache *media_cache_new(void) {
    MediaCache *mc = g_new0(MediaCache, 1);
    mc->cache_dir = g_build_filename(g_get_user_data_dir(), "meshlink", ".media", NULL);
    g_mkdir_with_parents(mc->cache_dir, 0700);
    mc->session = soup_session_new();
    g_object_set(mc->session, "ssl-strict", FALSE, NULL);
    return mc;
}

void media_cache_free(MediaCache *mc) {
    if (!mc) return;
    g_free(mc->cache_dir);
    g_object_unref(mc->session);
    g_free(mc);
}

/**
 * Get media file — returns local path. Downloads if not cached.
 */
char *media_cache_get(MediaCache *mc, const char *http_url, const char *token) {
    if (!http_url) return NULL;

    /* Generate cache filename from URL hash */
    guint hash = g_str_hash(http_url);
    char *filename = g_strdup_printf("%08x.bin", hash);
    char *local_path = g_build_filename(mc->cache_dir, filename, NULL);
    g_free(filename);

    /* Check if already cached */
    if (g_file_test(local_path, G_FILE_TEST_EXISTS)) return local_path;

    /* Download */
    SoupMessage *msg = soup_message_new("GET", http_url);
    if (token) {
        char *auth = g_strdup_printf("Bearer %s", token);
        soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
        g_free(auth);
    }

    GError *error = NULL;
    GBytes *bytes = soup_session_send_and_read(mc->session, msg, NULL, &error);
    g_object_unref(msg);

    if (error) { g_error_free(error); g_free(local_path); return NULL; }
    if (!bytes) { g_free(local_path); return NULL; }

    /* Save to file */
    gsize size;
    const guint8 *data = g_bytes_get_data(bytes, &size);
    GFile *file = g_file_new_for_path(local_path);
    GFileOutputStream *stream = g_file_create(file, G_FILE_CREATE_NONE, NULL, NULL);
    if (stream) {
        g_output_stream_write_all(G_OUTPUT_STREAM(stream), data, size, NULL, NULL, NULL);
        g_object_unref(stream);
    }
    g_object_unref(file);
    g_bytes_unref(bytes);

    return local_path;
}

/**
 * Upload file to Matrix media server. Returns mxc:// URI.
 */
char *media_cache_upload(MediaCache *mc, const char *file_path, const char *token, const char *base_url) {
    if (!file_path || !token || !base_url) return NULL;

    gchar *contents = NULL;
    gsize length = 0;
    if (!g_file_get_contents(file_path, &contents, &length, NULL)) return NULL;

    char *filename = g_path_get_basename(file_path);
    char *url = g_strdup_printf("%s/_matrix/media/v3/upload?filename=%s", base_url, filename);
    g_free(filename);

    SoupMessage *msg = soup_message_new("POST", url);
    g_free(url);

    char *auth = g_strdup_printf("Bearer %s", token);
    soup_message_headers_append(soup_message_get_request_headers(msg), "Authorization", auth);
    g_free(auth);

    GBytes *body = g_bytes_new_take(contents, length);
    soup_message_set_request_body_from_bytes(msg, "application/octet-stream", body);

    GError *error = NULL;
    GBytes *resp_bytes = soup_session_send_and_read(mc->session, msg, NULL, &error);
    g_object_unref(msg);
    g_bytes_unref(body);

    if (error) { g_error_free(error); return NULL; }
    if (!resp_bytes) return NULL;

    gsize resp_size;
    const char *resp_data = g_bytes_get_data(resp_bytes, &resp_size);
    JsonParser *parser = json_parser_new();
    json_parser_load_from_data(parser, resp_data, resp_size, NULL);
    JsonNode *root = json_parser_get_root(parser);
    char *mxc_url = NULL;
    if (root) {
        JsonObject *obj = json_node_get_object(root);
        if (json_object_has_member(obj, "content_uri"))
            mxc_url = g_strdup(json_object_get_string_member(obj, "content_uri"));
    }
    g_object_unref(parser);
    g_bytes_unref(resp_bytes);

    return mxc_url;
}

/**
 * Get cache size in bytes.
 */
gint64 media_cache_get_size(MediaCache *mc) {
    gint64 total = 0;
    GDir *dir = g_dir_open(mc->cache_dir, 0, NULL);
    if (!dir) return 0;
    const char *name;
    while ((name = g_dir_read_name(dir))) {
        char *path = g_build_filename(mc->cache_dir, name, NULL);
        GStatBuf st;
        if (g_stat(path, &st) == 0) total += st.st_size;
        g_free(path);
    }
    g_dir_close(dir);
    return total;
}

/**
 * Clear all cached media.
 */
void media_cache_clear(MediaCache *mc) {
    GDir *dir = g_dir_open(mc->cache_dir, 0, NULL);
    if (!dir) return;
    const char *name;
    while ((name = g_dir_read_name(dir))) {
        char *path = g_build_filename(mc->cache_dir, name, NULL);
        g_remove(path);
        g_free(path);
    }
    g_dir_close(dir);
}
