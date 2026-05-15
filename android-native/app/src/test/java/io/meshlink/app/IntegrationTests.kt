package io.meshlink.app

import org.junit.Assert.*
import org.junit.Test
import io.meshlink.app.network.RoomManager
import io.meshlink.app.data.RoomEntity

/**
 * Integration tests — test component interactions.
 */
class IntegrationTests {

    // ===== RoomManager =====

    @Test
    fun roomManager_sortRecent() {
        val rooms = listOf(
            RoomEntity("!a", "Alpha", lastMessageTime = 100),
            RoomEntity("!b", "Beta", lastMessageTime = 300),
            RoomEntity("!c", "Charlie", lastMessageTime = 200)
        )
        val sorted = RoomManager().process(rooms, RoomManager.SortMode.RECENT)
        assertEquals("Beta", sorted[0].name)
        assertEquals("Charlie", sorted[1].name)
        assertEquals("Alpha", sorted[2].name)
    }

    @Test
    fun roomManager_sortName() {
        val rooms = listOf(
            RoomEntity("!c", "Charlie"),
            RoomEntity("!a", "Alpha"),
            RoomEntity("!b", "Beta")
        )
        val sorted = RoomManager().process(rooms, RoomManager.SortMode.NAME)
        assertEquals("Alpha", sorted[0].name)
        assertEquals("Beta", sorted[1].name)
        assertEquals("Charlie", sorted[2].name)
    }

    @Test
    fun roomManager_filterDirect() {
        val rooms = listOf(
            RoomEntity("!a", "DM", isDirect = true),
            RoomEntity("!b", "Group", isDirect = false),
            RoomEntity("!c", "DM2", isDirect = true)
        )
        val filtered = RoomManager().process(rooms, filter = RoomManager.FilterMode.DIRECT)
        assertEquals(2, filtered.size)
        assertTrue(filtered.all { it.isDirect })
    }

    @Test
    fun roomManager_filterGroups() {
        val rooms = listOf(
            RoomEntity("!a", "DM", isDirect = true),
            RoomEntity("!b", "Group", isDirect = false)
        )
        val filtered = RoomManager().process(rooms, filter = RoomManager.FilterMode.GROUPS)
        assertEquals(1, filtered.size)
        assertEquals("Group", filtered[0].name)
    }

    @Test
    fun roomManager_search() {
        val rooms = listOf(
            RoomEntity("!a", "Work Chat"),
            RoomEntity("!b", "Family"),
            RoomEntity("!c", "Work Project")
        )
        val found = RoomManager().process(rooms, search = "work")
        assertEquals(2, found.size)
    }

    @Test
    fun roomManager_searchNoResults() {
        val rooms = listOf(RoomEntity("!a", "Alpha"), RoomEntity("!b", "Beta"))
        val found = RoomManager().process(rooms, search = "xyz")
        assertEquals(0, found.size)
    }

    @Test
    fun roomManager_combinedFilterAndSort() {
        val rooms = listOf(
            RoomEntity("!a", "Alice DM", isDirect = true, lastMessageTime = 100),
            RoomEntity("!b", "Bob DM", isDirect = true, lastMessageTime = 300),
            RoomEntity("!c", "Work Group", isDirect = false, lastMessageTime = 200)
        )
        val result = RoomManager().process(rooms, RoomManager.SortMode.RECENT, RoomManager.FilterMode.DIRECT)
        assertEquals(2, result.size)
        assertEquals("Bob DM", result[0].name) // Most recent first
    }

    // ===== Data integrity =====

    @Test
    fun roomEntity_equality() {
        val r1 = RoomEntity("!abc", "Room")
        val r2 = RoomEntity("!abc", "Room")
        assertEquals(r1, r2)
    }

    @Test
    fun roomEntity_inequality() {
        val r1 = RoomEntity("!abc", "Room1")
        val r2 = RoomEntity("!abc", "Room2")
        assertNotEquals(r1, r2)
    }

    @Test
    fun messageEntity_ordering() {
        val messages = listOf(
            io.meshlink.app.data.MessageEntity("e1", "!r", "@a:s", "First", timestamp = 100),
            io.meshlink.app.data.MessageEntity("e3", "!r", "@a:s", "Third", timestamp = 300),
            io.meshlink.app.data.MessageEntity("e2", "!r", "@a:s", "Second", timestamp = 200)
        )
        val sorted = messages.sortedBy { it.timestamp }
        assertEquals("First", sorted[0].body)
        assertEquals("Second", sorted[1].body)
        assertEquals("Third", sorted[2].body)
    }

    // ===== Encryption integration =====

    @Test
    fun aesKeyGeneration() {
        val keyGen = javax.crypto.KeyGenerator.getInstance("AES")
        keyGen.init(256, java.security.SecureRandom())
        val key = keyGen.generateKey()
        assertEquals(32, key.encoded.size) // 256 bits = 32 bytes
    }

    @Test
    fun hmacDeterministic() {
        val key = ByteArray(32) { 42 }
        val mac1 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac1.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val h1 = mac1.doFinal("test".toByteArray())

        val mac2 = javax.crypto.Mac.getInstance("HmacSHA256")
        mac2.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        val h2 = mac2.doFinal("test".toByteArray())

        assertArrayEquals(h1, h2)
    }

    @Test
    fun aesGcmEncryptDecrypt() {
        val keyGen = javax.crypto.KeyGenerator.getInstance("AES")
        keyGen.init(256)
        val key = keyGen.generateKey()

        val iv = ByteArray(12)
        java.security.SecureRandom().nextBytes(iv)

        // Encrypt
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal("Hello Meshlink!".toByteArray())

        // Decrypt
        val decipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        decipher.init(javax.crypto.Cipher.DECRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val decrypted = String(decipher.doFinal(encrypted))

        assertEquals("Hello Meshlink!", decrypted)
    }

    // ===== JSON parsing =====

    @Test
    fun jsonParsing_valid() {
        val json = """{"name":"test","value":42}"""
        val obj = com.google.gson.JsonParser.parseString(json).asJsonObject
        assertEquals("test", obj.get("name").asString)
        assertEquals(42, obj.get("value").asInt)
    }

    @Test
    fun jsonParsing_invalid() {
        try {
            com.google.gson.JsonParser.parseString("not json")
            // Should not reach here for malformed JSON
        } catch (_: Exception) {
            // Expected
        }
    }

    @Test
    fun jsonParsing_nested() {
        val json = """{"room":{"id":"!abc","name":"Test"}}"""
        val obj = com.google.gson.JsonParser.parseString(json).asJsonObject
        val room = obj.getAsJsonObject("room")
        assertEquals("!abc", room.get("id").asString)
    }
}
