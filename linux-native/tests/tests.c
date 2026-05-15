/**
 * Unit tests for Meshlink Linux.
 * Compile: gcc -o tests tests.c ../src/util/helpers.c $(pkg-config --cflags --libs glib-2.0)
 */

#include <stdio.h>
#include <string.h>
#include <assert.h>
#include <glib.h>

/* Import helpers */
extern char *meshlink_format_size(gint64 bytes);
extern char *meshlink_username(const char *user_id);
extern char *meshlink_initials(const char *name);

static int tests_passed = 0;
static int tests_failed = 0;

#define TEST(name) printf("  Testing: %s... ", name)
#define PASS() do { printf("✅\n"); tests_passed++; } while(0)
#define FAIL(msg) do { printf("❌ %s\n", msg); tests_failed++; } while(0)
#define ASSERT_STR(a, b) do { if (strcmp(a, b) != 0) { FAIL(#a " != " #b); return; } } while(0)
#define ASSERT_TRUE(x) do { if (!(x)) { FAIL(#x " is false"); return; } } while(0)
#define ASSERT_NULL(x) do { if ((x) != NULL) { FAIL(#x " is not NULL"); return; } } while(0)

/* ===== Format size tests ===== */
void test_format_size_bytes(void) {
    TEST("format_size bytes");
    char *r = meshlink_format_size(0);
    ASSERT_STR(r, "0 B"); g_free(r);
    r = meshlink_format_size(512);
    ASSERT_STR(r, "512 B"); g_free(r);
    PASS();
}

void test_format_size_kb(void) {
    TEST("format_size KB");
    char *r = meshlink_format_size(1024);
    ASSERT_STR(r, "1 KB"); g_free(r);
    r = meshlink_format_size(10240);
    ASSERT_STR(r, "10 KB"); g_free(r);
    PASS();
}

void test_format_size_mb(void) {
    TEST("format_size MB");
    char *r = meshlink_format_size(1048576);
    ASSERT_STR(r, "1 MB"); g_free(r);
    PASS();
}

/* ===== Username tests ===== */
void test_username_simple(void) {
    TEST("username simple");
    char *r = meshlink_username("@admin:server.com");
    ASSERT_STR(r, "admin"); g_free(r);
    PASS();
}

void test_username_complex(void) {
    TEST("username complex");
    char *r = meshlink_username("@user.name:matrix.org");
    ASSERT_STR(r, "user.name"); g_free(r);
    PASS();
}

void test_username_null(void) {
    TEST("username null");
    char *r = meshlink_username(NULL);
    ASSERT_STR(r, "?"); g_free(r);
    PASS();
}

/* ===== Initials tests ===== */
void test_initials_normal(void) {
    TEST("initials normal");
    char *r = meshlink_initials("Admin");
    ASSERT_STR(r, "AD"); g_free(r);
    PASS();
}

void test_initials_short(void) {
    TEST("initials short");
    char *r = meshlink_initials("A");
    ASSERT_STR(r, "?"); g_free(r);
    PASS();
}

void test_initials_null(void) {
    TEST("initials null");
    char *r = meshlink_initials(NULL);
    ASSERT_STR(r, "?"); g_free(r);
    PASS();
}

/* ===== String tests ===== */
void test_string_operations(void) {
    TEST("string operations");
    char *lower = g_utf8_strdown("HELLO", -1);
    ASSERT_STR(lower, "hello"); g_free(lower);

    char *upper = g_utf8_strup("hello", -1);
    ASSERT_STR(upper, "HELLO"); g_free(upper);

    ASSERT_TRUE(g_str_has_prefix("mxc://server/media", "mxc://"));
    ASSERT_TRUE(!g_str_has_prefix("https://url", "mxc://"));
    PASS();
}

void test_uri_escape(void) {
    TEST("URI escape");
    char *escaped = g_uri_escape_string("!room:server", NULL, TRUE);
    ASSERT_TRUE(escaped != NULL);
    ASSERT_TRUE(strlen(escaped) > 0);
    g_free(escaped);
    PASS();
}

void test_base64(void) {
    TEST("base64 encode/decode");
    const char *input = "Hello Meshlink!";
    char *encoded = g_base64_encode((guchar*)input, strlen(input));
    ASSERT_TRUE(encoded != NULL);

    gsize out_len;
    guchar *decoded = g_base64_decode(encoded, &out_len);
    ASSERT_TRUE(memcmp(decoded, input, strlen(input)) == 0);

    g_free(encoded); g_free(decoded);
    PASS();
}

void test_json_parse(void) {
    TEST("JSON parse");
    JsonParser *parser = json_parser_new();
    gboolean ok = json_parser_load_from_data(parser, "{\"name\":\"test\",\"value\":42}", -1, NULL);
    ASSERT_TRUE(ok);

    JsonObject *obj = json_node_get_object(json_parser_get_root(parser));
    ASSERT_STR(json_object_get_string_member(obj, "name"), "test");
    ASSERT_TRUE(json_object_get_int_member(obj, "value") == 42);

    g_object_unref(parser);
    PASS();
}

void test_json_invalid(void) {
    TEST("JSON invalid");
    JsonParser *parser = json_parser_new();
    gboolean ok = json_parser_load_from_data(parser, "not json", -1, NULL);
    ASSERT_TRUE(!ok);
    g_object_unref(parser);
    PASS();
}

void test_file_operations(void) {
    TEST("file operations");
    char *tmp = g_build_filename(g_get_tmp_dir(), "meshlink_test.txt", NULL);
    g_file_set_contents(tmp, "test data", -1, NULL);
    ASSERT_TRUE(g_file_test(tmp, G_FILE_TEST_EXISTS));

    char *contents = NULL;
    g_file_get_contents(tmp, &contents, NULL, NULL);
    ASSERT_STR(contents, "test data");

    g_remove(tmp);
    ASSERT_TRUE(!g_file_test(tmp, G_FILE_TEST_EXISTS));

    g_free(tmp); g_free(contents);
    PASS();
}

void test_hash(void) {
    TEST("string hash");
    guint h1 = g_str_hash("test");
    guint h2 = g_str_hash("test");
    ASSERT_TRUE(h1 == h2); /* Deterministic */

    guint h3 = g_str_hash("other");
    ASSERT_TRUE(h1 != h3); /* Different strings */
    PASS();
}

/* ===== Run all ===== */
int main(int argc, char *argv[]) {
    printf("=== Meshlink Linux Tests ===\n\n");

    test_format_size_bytes();
    test_format_size_kb();
    test_format_size_mb();
    test_username_simple();
    test_username_complex();
    test_username_null();
    test_initials_normal();
    test_initials_short();
    test_initials_null();
    test_string_operations();
    test_uri_escape();
    test_base64();
    test_json_parse();
    test_json_invalid();
    test_file_operations();
    test_hash();

    printf("\n=== Results: %d passed, %d failed ===\n", tests_passed, tests_failed);
    return tests_failed > 0 ? 1 : 0;
}
