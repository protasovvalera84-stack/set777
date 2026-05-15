package io.meshlink.app.network
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyPair
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * End-to-End Encryption for Meshlink.
 *
 * Architecture:
 * - Each device generates RSA-2048 key pair
 * - Public key uploaded to Matrix (device keys)
 * - Messages encrypted with AES-256-GCM
 * - AES key encrypted with recipient's RSA public key
 * - Only recipient can decrypt with their private key
 *
 * All keys stored in app's private directory (deleted on uninstall).
 */
class E2EEncryption(private val securePrefs: io.meshlink.app.util.SecurePrefs) {

    companion object {
        private const val RSA_ALGORITHM = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
        private const val AES_ALGORITHM = "AES/GCM/NoPadding"
        private const val AES_KEY_SIZE = 256
        private const val GCM_TAG_LENGTH = 128
        private const val GCM_IV_LENGTH = 12
    }

    private var keyPair: KeyPair? = null

    /**
     * Initialize — generate or load RSA key pair.
     */
    fun init() {
        val savedPrivate = securePrefs.getExtra("e2ee_private_key")
        val savedPublic = securePrefs.getExtra("e2ee_public_key")

        if (savedPrivate != null && savedPublic != null) {
            try {
                val privateBytes = Base64.decode(savedPrivate, Base64.NO_WRAP)
                val publicBytes = Base64.decode(savedPublic, Base64.NO_WRAP)
                val keyFactory = java.security.KeyFactory.getInstance("RSA")
                val privateKey = keyFactory.generatePrivate(java.security.spec.PKCS8EncodedKeySpec(privateBytes))
                val publicKey = keyFactory.generatePublic(java.security.spec.X509EncodedKeySpec(publicBytes))
                keyPair = KeyPair(publicKey, privateKey)
                return
            } catch (_: Exception) {}
        }

        // Generate new key pair
        val generator = KeyPairGenerator.getInstance("RSA")
        generator.initialize(2048, SecureRandom())
        keyPair = generator.generateKeyPair()

        // Save to encrypted prefs
        securePrefs.setExtra("e2ee_private_key", Base64.encodeToString(keyPair!!.private.encoded, Base64.NO_WRAP))
        securePrefs.setExtra("e2ee_public_key", Base64.encodeToString(keyPair!!.public.encoded, Base64.NO_WRAP))
    }

    /**
     * Get public key as Base64 string (to share with others).
     */
    fun getPublicKeyBase64(): String {
        return Base64.encodeToString(keyPair?.public?.encoded ?: ByteArray(0), Base64.NO_WRAP)
    }

    /**
     * Encrypt a message for a recipient.
     * Returns: { encryptedMessage, encryptedKey, iv } all Base64 encoded.
     */
    fun encrypt(plaintext: String, recipientPublicKeyBase64: String): EncryptedPayload? {
        try {
            // Generate random AES key
            val aesKeyGen = KeyGenerator.getInstance("AES")
            aesKeyGen.init(AES_KEY_SIZE, SecureRandom())
            val aesKey = aesKeyGen.generateKey()

            // Encrypt message with AES-GCM
            val iv = ByteArray(GCM_IV_LENGTH)
            SecureRandom().nextBytes(iv)
            val cipher = Cipher.getInstance(AES_ALGORITHM)
            cipher.init(Cipher.ENCRYPT_MODE, aesKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
            val encryptedMessage = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            // Encrypt AES key with recipient's RSA public key
            val recipientKeyBytes = Base64.decode(recipientPublicKeyBase64, Base64.NO_WRAP)
            val keyFactory = java.security.KeyFactory.getInstance("RSA")
            val recipientPublicKey = keyFactory.generatePublic(java.security.spec.X509EncodedKeySpec(recipientKeyBytes))
            val rsaCipher = Cipher.getInstance(RSA_ALGORITHM)
            rsaCipher.init(Cipher.ENCRYPT_MODE, recipientPublicKey)
            val encryptedKey = rsaCipher.doFinal(aesKey.encoded)

            return EncryptedPayload(
                ciphertext = Base64.encodeToString(encryptedMessage, Base64.NO_WRAP),
                encryptedKey = Base64.encodeToString(encryptedKey, Base64.NO_WRAP),
                iv = Base64.encodeToString(iv, Base64.NO_WRAP)
            )
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Decrypt a message encrypted for this device.
     */
    fun decrypt(payload: EncryptedPayload): String? {
        try {
            val privateKey = keyPair?.private ?: return null

            // Decrypt AES key with our RSA private key
            val rsaCipher = Cipher.getInstance(RSA_ALGORITHM)
            rsaCipher.init(Cipher.DECRYPT_MODE, privateKey)
            val aesKeyBytes = rsaCipher.doFinal(Base64.decode(payload.encryptedKey, Base64.NO_WRAP))
            val aesKey: SecretKey = SecretKeySpec(aesKeyBytes, "AES")

            // Decrypt message with AES-GCM
            val iv = Base64.decode(payload.iv, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(AES_ALGORITHM)
            cipher.init(Cipher.DECRYPT_MODE, aesKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
            val plaintext = cipher.doFinal(Base64.decode(payload.ciphertext, Base64.NO_WRAP))

            return String(plaintext, Charsets.UTF_8)
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Upload device keys to Matrix server.
     */
    suspend fun uploadDeviceKeys(baseUrl: String, token: String, userId: String, deviceId: String) {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val publicKey = getPublicKeyBase64()
                val body = com.google.gson.Gson().toJson(mapOf(
                    "device_keys" to mapOf(
                        "user_id" to userId,
                        "device_id" to deviceId,
                        "algorithms" to listOf("m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"),
                        "keys" to mapOf(
                            "curve25519:$deviceId" to publicKey,
                            "ed25519:$deviceId" to publicKey
                        )
                    )
                ))
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/keys/upload")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                okhttp3.OkHttpClient().newCall(request).execute()
            } catch (_: Exception) {}
        }
    }

    /**
     * Get device keys for a user from server.
     */
    suspend fun getDeviceKeys(baseUrl: String, token: String, userId: String): Map<String, String> {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val body = com.google.gson.Gson().toJson(mapOf(
                    "device_keys" to mapOf(userId to emptyList<String>())
                ))
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/keys/query")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                val response = okhttp3.OkHttpClient().newCall(request).execute()
                val json = com.google.gson.JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
                val deviceKeys = json.getAsJsonObject("device_keys")
                    ?.getAsJsonObject(userId) ?: return@withContext emptyMap()

                val keys = mutableMapOf<String, String>()
                for ((deviceId, deviceData) in deviceKeys.entrySet()) {
                    val keysObj = deviceData.asJsonObject.getAsJsonObject("keys") ?: continue
                    for ((keyId, keyValue) in keysObj.entrySet()) {
                        if (keyId.startsWith("curve25519:")) {
                            keys[deviceId] = keyValue.asString
                        }
                    }
                }
                keys
            } catch (_: Exception) { emptyMap() }
        }
    }
}

data class EncryptedPayload(
    val ciphertext: String,
    val encryptedKey: String,
    val iv: String
)
