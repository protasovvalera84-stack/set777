#ifndef SECURE_STORAGE_H
#define SECURE_STORAGE_H
#include <glib.h>
typedef struct _SecureStorage SecureStorage;
SecureStorage *secure_storage_new(void);
void secure_storage_free(SecureStorage *s);
void secure_storage_set(SecureStorage *s, const char *key, const char *value);
const char *secure_storage_get(SecureStorage *s, const char *key);
void secure_storage_clear(SecureStorage *s);
#endif
