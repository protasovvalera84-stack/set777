/**
 * E2E Encryption for Linux — OpenSSL RSA + AES-GCM.
 */

#include <openssl/rsa.h>
#include <openssl/pem.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/err.h>
#include <glib.h>
#include <string.h>

typedef struct {
    EVP_PKEY *key_pair;
    char *public_key_b64;
    char *private_key_b64;
} E2EEncryption;

typedef struct {
    char *ciphertext;
    char *encrypted_key;
    char *iv;
} EncryptedPayload;

E2EEncryption *e2ee_new(void) {
    E2EEncryption *e = g_new0(E2EEncryption, 1);

    /* Generate RSA-2048 key pair */
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_RSA, NULL);
    EVP_PKEY_keygen_init(ctx);
    EVP_PKEY_CTX_set_rsa_keygen_bits(ctx, 2048);
    EVP_PKEY_keygen(ctx, &e->key_pair);
    EVP_PKEY_CTX_free(ctx);

    /* Export public key */
    BIO *bio = BIO_new(BIO_s_mem());
    PEM_write_bio_PUBKEY(bio, e->key_pair);
    char *pem_data = NULL;
    long pem_len = BIO_get_mem_data(bio, &pem_data);
    e->public_key_b64 = g_base64_encode((guchar*)pem_data, pem_len);
    BIO_free(bio);

    return e;
}

void e2ee_free(E2EEncryption *e) {
    if (!e) return;
    if (e->key_pair) EVP_PKEY_free(e->key_pair);
    g_free(e->public_key_b64);
    g_free(e->private_key_b64);
    g_free(e);
}

const char *e2ee_get_public_key(E2EEncryption *e) {
    return e->public_key_b64;
}

/**
 * Encrypt message with AES-256-GCM, encrypt AES key with RSA.
 */
EncryptedPayload *e2ee_encrypt(E2EEncryption *e, const char *plaintext, const char *recipient_pubkey_b64) {
    if (!plaintext || !recipient_pubkey_b64) return NULL;

    /* Generate random AES key and IV */
    unsigned char aes_key[32], iv[12], tag[16];
    RAND_bytes(aes_key, 32);
    RAND_bytes(iv, 12);

    /* Encrypt with AES-256-GCM */
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, aes_key, iv);

    int len = strlen(plaintext);
    unsigned char *ciphertext = g_malloc(len + 16);
    int ct_len = 0;
    EVP_EncryptUpdate(ctx, ciphertext, &ct_len, (unsigned char*)plaintext, len);
    int final_len = 0;
    EVP_EncryptFinal_ex(ctx, ciphertext + ct_len, &final_len);
    ct_len += final_len;
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag);
    EVP_CIPHER_CTX_free(ctx);

    /* Encrypt AES key with recipient's RSA public key */
    gsize pubkey_len;
    guchar *pubkey_der = g_base64_decode(recipient_pubkey_b64, &pubkey_len);
    BIO *bio = BIO_new_mem_buf(pubkey_der, pubkey_len);
    EVP_PKEY *recipient_key = PEM_read_bio_PUBKEY(bio, NULL, NULL, NULL);
    BIO_free(bio);
    g_free(pubkey_der);

    if (!recipient_key) { g_free(ciphertext); return NULL; }

    EVP_PKEY_CTX *rsa_ctx = EVP_PKEY_CTX_new(recipient_key, NULL);
    EVP_PKEY_encrypt_init(rsa_ctx);
    EVP_PKEY_CTX_set_rsa_padding(rsa_ctx, RSA_PKCS1_OAEP_PADDING);

    size_t encrypted_key_len;
    EVP_PKEY_encrypt(rsa_ctx, NULL, &encrypted_key_len, aes_key, 32);
    unsigned char *encrypted_key = g_malloc(encrypted_key_len);
    EVP_PKEY_encrypt(rsa_ctx, encrypted_key, &encrypted_key_len, aes_key, 32);
    EVP_PKEY_CTX_free(rsa_ctx);
    EVP_PKEY_free(recipient_key);

    EncryptedPayload *payload = g_new0(EncryptedPayload, 1);
    payload->ciphertext = g_base64_encode(ciphertext, ct_len);
    payload->encrypted_key = g_base64_encode(encrypted_key, encrypted_key_len);
    payload->iv = g_base64_encode(iv, 12);

    g_free(ciphertext);
    g_free(encrypted_key);
    return payload;
}

/**
 * Decrypt message.
 */
char *e2ee_decrypt(E2EEncryption *e, EncryptedPayload *payload) {
    if (!e || !e->key_pair || !payload) return NULL;

    /* Decrypt AES key with our RSA private key */
    gsize ek_len;
    guchar *encrypted_key = g_base64_decode(payload->encrypted_key, &ek_len);

    EVP_PKEY_CTX *rsa_ctx = EVP_PKEY_CTX_new(e->key_pair, NULL);
    EVP_PKEY_decrypt_init(rsa_ctx);
    EVP_PKEY_CTX_set_rsa_padding(rsa_ctx, RSA_PKCS1_OAEP_PADDING);

    size_t aes_key_len;
    EVP_PKEY_decrypt(rsa_ctx, NULL, &aes_key_len, encrypted_key, ek_len);
    unsigned char *aes_key = g_malloc(aes_key_len);
    EVP_PKEY_decrypt(rsa_ctx, aes_key, &aes_key_len, encrypted_key, ek_len);
    EVP_PKEY_CTX_free(rsa_ctx);
    g_free(encrypted_key);

    /* Decrypt with AES-256-GCM */
    gsize iv_len, ct_len;
    guchar *iv = g_base64_decode(payload->iv, &iv_len);
    guchar *ciphertext = g_base64_decode(payload->ciphertext, &ct_len);

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, aes_key, iv);

    unsigned char *plaintext = g_malloc(ct_len + 1);
    int pt_len = 0;
    EVP_DecryptUpdate(ctx, plaintext, &pt_len, ciphertext, ct_len);
    EVP_DecryptFinal_ex(ctx, plaintext + pt_len, &pt_len);
    EVP_CIPHER_CTX_free(ctx);

    plaintext[pt_len] = '\0';

    g_free(aes_key); g_free(iv); g_free(ciphertext);
    return (char*)plaintext;
}

void encrypted_payload_free(EncryptedPayload *p) {
    if (!p) return;
    g_free(p->ciphertext); g_free(p->encrypted_key); g_free(p->iv);
    g_free(p);
}
