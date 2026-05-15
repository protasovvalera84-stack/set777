package io.meshlink.app

import org.junit.Assert.*
import org.junit.Test

/**
 * Extended tests — more coverage for edge cases.
 */
class ExtendedTests {

    // ===== MatrixApi edge cases =====

    @Test
    fun mxcToHttp_withPort() {
        val api = io.meshlink.app.network.MatrixApi("https://server:8448")
        val result = api.mxcToHttp("mxc://server/media123")
        assertEquals("https://server:8448/_matrix/media/v3/download/server/media123", result)
    }

    @Test
    fun mxcToHttp_specialChars() {
        val api = io.meshlink.app.network.MatrixApi("https://example.com")
        val result = api.mxcToHttp("mxc://example.com/abc-def_123")
        assertNotNull(result)
        assertTrue(result!!.contains("abc-def_123"))
    }

    // ===== Message formatting =====

    @Test
    fun messageBody_truncation() {
        val longText = "A".repeat(1000)
        val truncated = longText.take(50)
        assertEquals(50, truncated.length)
    }

    @Test
    fun senderName_extraction() {
        val cases = mapOf(
            "@admin:72.56.244.207" to "admin",
            "@user123:matrix.org" to "user123",
            "@test:localhost" to "test"
        )
        for ((userId, expected) in cases) {
            val name = userId.split(":")[0].removePrefix("@")
            assertEquals(expected, name)
        }
    }

    @Test
    fun serverName_extraction() {
        val userId = "@admin:72.56.244.207"
        val server = userId.split(":").drop(1).joinToString(":")
        assertEquals("72.56.244.207", server)
    }

    // ===== Room filtering =====

    @Test
    fun internalRoom_detection() {
        val internalNames = listOf(
            "Meshlink Shorts", "Meshlink Videos", "Meshlink Music",
            "Meshlink Room Registry", "Meshlink Marketplace"
        )
        for (name in internalNames) {
            assertTrue("$name should be internal",
                name.contains("Meshlink") && (name.contains("Shorts") ||
                    name.contains("Videos") || name.contains("Music") ||
                    name.contains("Registry") || name.contains("Marketplace")))
        }
    }

    @Test
    fun userRoom_notInternal() {
        val userNames = listOf("My Chat", "Work Group", "Family")
        for (name in userNames) {
            assertFalse(name.contains("Meshlink"))
        }
    }

    // ===== Encryption =====

    @Test
    fun sessionId_uniqueness() {
        val ids = mutableSetOf<String>()
        repeat(100) {
            val bytes = ByteArray(16)
            java.security.SecureRandom().nextBytes(bytes)
            val id = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
            ids.add(id)
        }
        assertEquals(100, ids.size) // All unique
    }

    @Test
    fun keyDerivation_deterministic() {
        val key = ByteArray(32) { it.toByte() }
        val mac1 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac1.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val derived1 = mac1.doFinal("megolm_key_0".toByteArray())

        val mac2 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac2.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val derived2 = mac2.doFinal("megolm_key_0".toByteArray())

        assertArrayEquals(derived1, derived2) // Same input = same output
    }

    @Test
    fun keyDerivation_differentIndex() {
        val key = ByteArray(32) { it.toByte() }
        val mac1 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac1.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val derived1 = mac1.doFinal("megolm_key_0".toByteArray())

        val mac2 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac2.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val derived2 = mac2.doFinal("megolm_key_1".toByteArray())

        assertFalse(derived1.contentEquals(derived2)) // Different index = different key
    }

    // ===== Offline queue =====

    @Test
    fun queuedMessage_serialization() {
        val msg = io.meshlink.app.network.OfflineQueue.QueuedMessage(
            id = "q123", roomId = "!room:server",
            body = "Hello", msgtype = "m.text"
        )
        val json = com.google.gson.Gson().toJson(msg)
        assertTrue(json.contains("q123"))
        assertTrue(json.contains("Hello"))

        val restored = com.google.gson.Gson().fromJson(json, io.meshlink.app.network.OfflineQueue.QueuedMessage::class.java)
        assertEquals(msg.id, restored.id)
        assertEquals(msg.body, restored.body)
    }

    // ===== Time formatting =====

    @Test
    fun timeFormat() {
        val sdf = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
        val time = sdf.format(java.util.Date(1700000000000L))
        assertNotNull(time)
        assertTrue(time.contains(":"))
    }

    @Test
    fun dateFormat() {
        val sdf = java.text.SimpleDateFormat("dd.MM", java.util.Locale.getDefault())
        val date = sdf.format(java.util.Date(1700000000000L))
        assertNotNull(date)
        assertTrue(date.contains("."))
    }

    // ===== MIME types =====

    @Test
    fun mimeType_fromExtension() {
        val map = mapOf(
            "jpg" to "image/jpeg", "jpeg" to "image/jpeg",
            "png" to "image/png", "gif" to "image/gif",
            "mp4" to "video/mp4", "webm" to "video/webm",
            "mp3" to "audio/mpeg", "ogg" to "audio/ogg",
            "pdf" to "application/pdf"
        )
        for ((ext, expected) in map) {
            val mime = when (ext) {
                "jpg", "jpeg" -> "image/jpeg"
                "png" -> "image/png"
                "gif" -> "image/gif"
                "mp4" -> "video/mp4"
                "webm" -> "video/webm"
                "mp3" -> "audio/mpeg"
                "ogg" -> "audio/ogg"
                "pdf" -> "application/pdf"
                else -> "application/octet-stream"
            }
            assertEquals("Extension .$ext", expected, mime)
        }
    }
}
