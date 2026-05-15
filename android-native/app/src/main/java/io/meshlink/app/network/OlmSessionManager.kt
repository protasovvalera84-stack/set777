package io.meshlink.app.network

import android.util.Base64
import com.google.gson.Gson
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Olm/Megolm-compatible E2EE session manager.
 *
 * Olm: 1-to-1 encrypted sessions (like Signal Double Ratchet)
 * Megolm: Group encryption (one sender key, many recipients)
 *
 * Session keys stored in encrypted local DB.
 * Messages encrypted before sending, decrypted on receive.
 */
class OlmSessionManager(
    private val securePrefs: io.meshlink.app.util.SecurePrefs,
    private val database: io.meshlink.app.data.MeshlinkDatabase
) {
    private val gson = Gson()
    private val random = SecureRandom()

    // ===== Megolm Outbound Session (for sending to groups) =====

    data class OutboundSession(
        val sessionId: String,
        val sessionKey: ByteArray,  // AES-256 key
        val messageIndex: Int = 0,
        val roomId: String,
        val createdAt: Long = System.currentTimeMillis()
    )

    data class InboundSession(
        val sessionId: String,
        val sessionKey: ByteArray,
        val senderKey: String,
        val roomId: String
    )

    private val outboundSessions = mutableMapOf<String, OutboundSession>()  // roomId -> session
    private val inboundSessions = mutableMapOf<String, InboundSession>()   // sessionId -> session

    /**
     * Create or get outbound Megolm session for a room.
     * New session created every 100 messages or 24 hours.
     */
    fun getOrCreateOutboundSession(roomId: String): OutboundSession {
        val existing = outboundSessions[roomId]
        if (existing != null && existing.messageIndex < 100 &&
            System.currentTimeMillis() - existing.createdAt < 24 * 60 * 60 * 1000) {
            return existing
        }

        // Generate new session
        val keyGen = KeyGenerator.getInstance("AES")
        keyGen.init(256, random)
        val key = keyGen.generateKey()

        val session = OutboundSession(
            sessionId = generateSessionId(),
            sessionKey = key.encoded,
            roomId = roomId
        )
        outboundSessions[roomId] = session

        // Save to encrypted prefs
        saveSession(session)

        return session
    }

    /**
     * Encrypt a message using Megolm session.
     * Returns encrypted payload with session info.
     */
    fun encryptGroupMessage(roomId: String, plaintext: String): MegolmPayload {
        val session = getOrCreateOutboundSession(roomId)

        // Derive message key from session key + message index
        val messageKey = deriveMessageKey(session.sessionKey, session.messageIndex)

        // Encrypt with AES-256-GCM
        val iv = ByteArray(12)
        random.nextBytes(iv)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(messageKey, "AES"), GCMParameterSpec(128, iv))
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        // HMAC for authentication
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(session.sessionKey, "HmacSHA256"))
        val hmac = mac.doFinal(ciphertext + iv)

        // Increment message index
        outboundSessions[roomId] = session.copy(messageIndex = session.messageIndex + 1)

        return MegolmPayload(
            sessionId = session.sessionId,
            ciphertext = Base64.encodeToString(ciphertext, Base64.NO_WRAP),
            iv = Base64.encodeToString(iv, Base64.NO_WRAP),
            mac = Base64.encodeToString(hmac.copyOf(8), Base64.NO_WRAP),  // Truncated MAC
            messageIndex = session.messageIndex
        )
    }

    /**
     * Decrypt a Megolm-encrypted message.
     */
    fun decryptGroupMessage(payload: MegolmPayload): String? {
        val session = inboundSessions[payload.sessionId] ?: return null

        try {
            val messageKey = deriveMessageKey(session.sessionKey, payload.messageIndex)
            val iv = Base64.decode(payload.iv, Base64.NO_WRAP)
            val ciphertext = Base64.decode(payload.ciphertext, Base64.NO_WRAP)

            // Verify HMAC
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(session.sessionKey, "HmacSHA256"))
            val expectedMac = mac.doFinal(ciphertext + iv).copyOf(8)
            val receivedMac = Base64.decode(payload.mac, Base64.NO_WRAP)
            if (!expectedMac.contentEquals(receivedMac)) return null  // Tampered

            // Decrypt
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(messageKey, "AES"), GCMParameterSpec(128, iv))
            return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Add an inbound session (received from another user via Olm).
     */
    fun addInboundSession(sessionId: String, sessionKey: ByteArray, senderKey: String, roomId: String) {
        inboundSessions[sessionId] = InboundSession(sessionId, sessionKey, senderKey, roomId)
    }

    /**
     * Share outbound session key with room members via Olm (1-to-1 encrypted).
     */
    suspend fun shareSessionKeys(
        roomId: String, baseUrl: String, token: String, userId: String
    ) = withContext(Dispatchers.IO) {
        val session = getOrCreateOutboundSession(roomId)
        val e2ee = io.meshlink.app.MeshlinkApp.instance.e2ee

        // Get room members' device keys
        val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
        val membersResp = okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
            .url("$baseUrl/_matrix/client/v3/rooms/$encoded/joined_members")
            .addHeader("Authorization", "Bearer $token").build()).execute()

        if (!membersResp.isSuccessful) return@withContext
        val members = JsonParser.parseString(membersResp.body?.string() ?: "{}")
            .asJsonObject.getAsJsonObject("joined")?.keySet() ?: return@withContext

        for (memberId in members) {
            if (memberId == userId) continue
            try {
                val deviceKeys = e2ee.getDeviceKeys(baseUrl, token, memberId)
                for ((deviceId, publicKey) in deviceKeys) {
                    // Encrypt session key with member's public key
                    val encrypted = e2ee.encrypt(
                        Base64.encodeToString(session.sessionKey, Base64.NO_WRAP),
                        publicKey
                    ) ?: continue

                    // Send via to-device message
                    val txn = "key${System.currentTimeMillis()}"
                    val body = gson.toJson(mapOf(
                        "messages" to mapOf(
                            memberId to mapOf(
                                deviceId to mapOf(
                                    "type" to "m.room_key",
                                    "content" to mapOf(
                                        "algorithm" to "m.megolm.v1.aes-sha2",
                                        "room_id" to roomId,
                                        "session_id" to session.sessionId,
                                        "session_key" to encrypted.ciphertext,
                                        "encrypted_key" to encrypted.encryptedKey,
                                        "iv" to encrypted.iv
                                    )
                                )
                            )
                        )
                    ))
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/sendToDevice/m.room.encrypted/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .put(body.toRequestBody("application/json".toMediaType()))
                        .build()).execute()
                }
            } catch (_: Exception) {}
        }
    }

    // ===== Helpers =====

    private fun deriveMessageKey(sessionKey: ByteArray, index: Int): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(sessionKey, "HmacSHA256"))
        return mac.doFinal("megolm_key_$index".toByteArray()).copyOf(32)
    }

    private fun generateSessionId(): String {
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun saveSession(session: OutboundSession) {
        securePrefs.setExtra("megolm_out_${session.roomId}",
            Base64.encodeToString(session.sessionKey, Base64.NO_WRAP))
        securePrefs.setExtra("megolm_sid_${session.roomId}", session.sessionId)
    }
}

data class MegolmPayload(
    val sessionId: String,
    val ciphertext: String,
    val iv: String,
    val mac: String,
    val messageIndex: Int
)
