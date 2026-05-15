package io.meshlink.app

import org.junit.Assert.*
import org.junit.Test

/**
 * Final comprehensive tests — covers all remaining components.
 */
class FinalTests {

    // ===== ProfileManager data classes =====

    @Test
    fun userProfile_creation() {
        val p = io.meshlink.app.network.UserProfile("Alice", "mxc://server/avatar")
        assertEquals("Alice", p.displayName)
        assertEquals("mxc://server/avatar", p.avatarUrl)
    }

    @Test
    fun userProfile_nullable() {
        val p = io.meshlink.app.network.UserProfile(null, null)
        assertNull(p.displayName)
        assertNull(p.avatarUrl)
    }

    @Test
    fun deviceInfo_creation() {
        val d = io.meshlink.app.network.DeviceInfo("DEV1", "My Phone", "1.2.3.4", 1000L)
        assertEquals("DEV1", d.deviceId)
        assertEquals("My Phone", d.displayName)
    }

    // ===== UserPresence =====

    @Test
    fun presence_online() {
        val p = io.meshlink.app.network.UserPresence("online", "Available", null)
        assertEquals("online", p.presence)
        assertEquals("Available", p.statusMsg)
    }

    @Test
    fun presence_offline() {
        val p = io.meshlink.app.network.UserPresence("offline", null, 300000L)
        assertEquals("offline", p.presence)
        assertEquals(300000L, p.lastActiveAgo)
    }

    // ===== MegolmPayload =====

    @Test
    fun megolmPayload_fullCycle() {
        val payload = io.meshlink.app.network.MegolmPayload(
            sessionId = "session123",
            ciphertext = "encrypted_data",
            iv = "random_iv",
            mac = "hmac_tag",
            messageIndex = 42
        )
        assertEquals("session123", payload.sessionId)
        assertEquals(42, payload.messageIndex)
        assertNotNull(payload.ciphertext)
        assertNotNull(payload.mac)
    }

    // ===== SearchResult =====

    @Test
    fun searchResult_types() {
        val types = listOf("room", "message", "user")
        for (type in types) {
            val r = io.meshlink.app.ui.SearchActivity.SearchResult(type, "Title", "Sub", "id")
            assertEquals(type, r.type)
        }
    }

    // ===== Shorts =====

    @Test
    fun shortItem_creation() {
        val s = io.meshlink.app.ui.ShortsFullActivity.ShortItem(
            "id1", "https://url", "Caption", "author", "@author:s", "video", 1000L
        )
        assertEquals("video", s.type)
        assertEquals(0, s.likes)
        assertFalse(s.liked)
    }

    @Test
    fun shortItem_like() {
        val s = io.meshlink.app.ui.ShortsFullActivity.ShortItem(
            "id1", "url", "", "a", "@a:s", "image", 0
        )
        s.liked = true
        s.likes = 1
        assertTrue(s.liked)
        assertEquals(1, s.likes)
    }

    // ===== Marketplace =====

    @Test
    fun listing_creation() {
        val l = io.meshlink.app.ui.MarketFullActivity.Listing(
            "id", "iPhone", "Good condition", "500", "Electronics",
            "Moscow", null, "seller", "@seller:s", 1000L
        )
        assertEquals("iPhone", l.title)
        assertEquals("500", l.price)
        assertEquals("Electronics", l.category)
    }

    // ===== Music =====

    @Test
    fun track_creation() {
        val t = io.meshlink.app.ui.MusicPlayerActivity.Track(
            "id", "Song Title", "Artist", "https://url", "mxc://url"
        )
        assertEquals("Song Title", t.title)
        assertEquals("Artist", t.author)
    }

    // ===== Friends =====

    @Test
    fun friend_statuses() {
        val statuses = listOf("friend", "pending_sent", "pending_received")
        for (status in statuses) {
            val f = io.meshlink.app.ui.ContactsActivity.Friend("@u:s", "Name", status)
            assertEquals(status, f.status)
        }
    }

    // ===== GroupSettings =====

    @Test
    fun member_creation() {
        val m = io.meshlink.app.ui.GroupSettingsActivity.Member("@admin:s", "Admin", 100)
        assertEquals("@admin:s", m.userId)
        assertEquals(100, m.powerLevel)
    }

    // ===== OfflineQueue =====

    @Test
    fun queuedMessage_retries() {
        val msg = io.meshlink.app.network.OfflineQueue.QueuedMessage(
            "q1", "!room", "Hello", retries = 5
        )
        assertEquals(5, msg.retries)
        assertTrue(msg.retries < 10) // Under max retries
    }

    @Test
    fun queuedMessage_maxRetries() {
        val msg = io.meshlink.app.network.OfflineQueue.QueuedMessage(
            "q1", "!room", "Hello", retries = 10
        )
        assertFalse(msg.retries < 10) // At max retries
    }

    // ===== Data consistency =====

    @Test
    fun roomEntity_withAllFields() {
        val room = io.meshlink.app.data.RoomEntity(
            roomId = "!abc:server",
            name = "Test Room",
            avatarUrl = "mxc://server/avatar",
            topic = "Room topic",
            lastMessage = "Last msg",
            lastMessageTime = 999L,
            unreadCount = 5,
            isDirect = true
        )
        assertEquals("!abc:server", room.roomId)
        assertEquals("mxc://server/avatar", room.avatarUrl)
        assertEquals("Room topic", room.topic)
        assertEquals(5, room.unreadCount)
        assertTrue(room.isDirect)
    }

    @Test
    fun messageEntity_withMedia() {
        val msg = io.meshlink.app.data.MessageEntity(
            eventId = "e1", roomId = "!r", sender = "@u:s",
            body = "photo.jpg", msgtype = "m.image", timestamp = 0,
            mediaUrl = "mxc://server/photo", localMediaPath = "/data/photo.jpg"
        )
        assertEquals("m.image", msg.msgtype)
        assertEquals("mxc://server/photo", msg.mediaUrl)
        assertEquals("/data/photo.jpg", msg.localMediaPath)
    }

    // ===== Encryption roundtrip =====

    @Test
    fun aesGcm_largeMessage() {
        val keyGen = javax.crypto.KeyGenerator.getInstance("AES")
        keyGen.init(256)
        val key = keyGen.generateKey()
        val iv = ByteArray(12); java.security.SecureRandom().nextBytes(iv)

        val plaintext = "A".repeat(10000) // 10KB message

        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plaintext.toByteArray())

        val decipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        decipher.init(javax.crypto.Cipher.DECRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val decrypted = String(decipher.doFinal(encrypted))

        assertEquals(plaintext, decrypted)
    }

    @Test
    fun aesGcm_unicodeMessage() {
        val keyGen = javax.crypto.KeyGenerator.getInstance("AES")
        keyGen.init(256)
        val key = keyGen.generateKey()
        val iv = ByteArray(12); java.security.SecureRandom().nextBytes(iv)

        val plaintext = "Привет мир! 🌍 こんにちは العربية"

        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        val decipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        decipher.init(javax.crypto.Cipher.DECRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val decrypted = String(decipher.doFinal(encrypted), Charsets.UTF_8)

        assertEquals(plaintext, decrypted)
    }
}
