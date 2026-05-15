package io.meshlink.app

import io.meshlink.app.network.MatrixApi
import io.meshlink.app.network.OfflineQueue
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for core Meshlink components.
 */
class MatrixApiTest {

    @Test
    fun mxcToHttp_validUrl() {
        val api = MatrixApi("https://example.com")
        val result = api.mxcToHttp("mxc://example.com/abc123")
        assertEquals("https://example.com/_matrix/media/v3/download/example.com/abc123", result)
    }

    @Test
    fun mxcToHttp_invalidUrl() {
        val api = MatrixApi("https://example.com")
        assertNull(api.mxcToHttp("https://not-mxc"))
        assertNull(api.mxcToHttp(null))
        assertNull(api.mxcToHttp(""))
    }

    @Test
    fun mxcToHttp_noSlash() {
        val api = MatrixApi("https://example.com")
        assertNull(api.mxcToHttp("mxc://noslash"))
    }
}

class LoginResponseTest {

    @Test
    fun loginResponse_success() {
        val resp = io.meshlink.app.network.LoginResponse(
            user_id = "@user:server",
            access_token = "token123",
            device_id = "DEVICE1"
        )
        assertNotNull(resp.access_token)
        assertNotNull(resp.user_id)
        assertNull(resp.errcode)
    }

    @Test
    fun loginResponse_error() {
        val resp = io.meshlink.app.network.LoginResponse(
            errcode = "M_FORBIDDEN",
            error = "Invalid password"
        )
        assertNull(resp.access_token)
        assertNotNull(resp.errcode)
    }
}

class MessageEntityTest {

    @Test
    fun messageEntity_creation() {
        val msg = io.meshlink.app.data.MessageEntity(
            eventId = "evt1",
            roomId = "!room:server",
            sender = "@user:server",
            body = "Hello",
            msgtype = "m.text",
            timestamp = 1000L
        )
        assertEquals("evt1", msg.eventId)
        assertEquals("Hello", msg.body)
        assertEquals("m.text", msg.msgtype)
    }

    @Test
    fun messageEntity_mediaTypes() {
        val types = listOf("m.text", "m.image", "m.video", "m.audio", "m.file")
        for (type in types) {
            val msg = io.meshlink.app.data.MessageEntity(
                eventId = "e", roomId = "r", sender = "s",
                body = "test", msgtype = type, timestamp = 0
            )
            assertEquals(type, msg.msgtype)
        }
    }
}

class RoomEntityTest {

    @Test
    fun roomEntity_creation() {
        val room = io.meshlink.app.data.RoomEntity(
            roomId = "!room:server",
            name = "Test Room",
            lastMessage = "Hello",
            lastMessageTime = 1000L
        )
        assertEquals("!room:server", room.roomId)
        assertEquals("Test Room", room.name)
    }

    @Test
    fun roomEntity_defaults() {
        val room = io.meshlink.app.data.RoomEntity(
            roomId = "!room:server",
            name = "Room"
        )
        assertNull(room.avatarUrl)
        assertNull(room.lastMessage)
        assertEquals(0, room.lastMessageTime)
        assertEquals(0, room.unreadCount)
        assertFalse(room.isDirect)
    }
}

class EncryptionTest {

    @Test
    fun encryptedPayload_creation() {
        val payload = io.meshlink.app.network.EncryptedPayload(
            ciphertext = "abc",
            encryptedKey = "def",
            iv = "ghi"
        )
        assertEquals("abc", payload.ciphertext)
        assertEquals("def", payload.encryptedKey)
        assertEquals("ghi", payload.iv)
    }

    @Test
    fun megolmPayload_creation() {
        val payload = io.meshlink.app.network.MegolmPayload(
            sessionId = "sid",
            ciphertext = "ct",
            iv = "iv",
            mac = "mac",
            messageIndex = 5
        )
        assertEquals("sid", payload.sessionId)
        assertEquals(5, payload.messageIndex)
    }
}

class MediaCacheEntityTest {

    @Test
    fun mediaCacheEntity_creation() {
        val entry = io.meshlink.app.data.MediaCacheEntity(
            mxcUrl = "mxc://server/media1",
            localPath = "/data/media/file.jpg",
            mimeType = "image/jpeg",
            size = 1024
        )
        assertEquals("mxc://server/media1", entry.mxcUrl)
        assertEquals("/data/media/file.jpg", entry.localPath)
        assertEquals(1024, entry.size)
    }
}

class UtilsTest {

    @Test
    fun userIdParsing() {
        val userId = "@admin:72.56.244.207"
        val name = userId.split(":")[0].removePrefix("@")
        val server = userId.split(":")[1]
        assertEquals("admin", name)
        assertEquals("72.56.244.207", server)
    }

    @Test
    fun roomAlias() {
        val alias = "#meshlink-shorts-v3:72.56.244.207"
        assertTrue(alias.startsWith("#"))
        assertTrue(alias.contains(":"))
    }

    @Test
    fun mimeTypeDetection() {
        val types = mapOf(
            "photo.jpg" to "image/jpeg",
            "video.mp4" to "video/mp4",
            "audio.ogg" to "audio/ogg",
            "doc.pdf" to "application/pdf"
        )
        for ((file, expected) in types) {
            val ext = file.substringAfterLast(".")
            val mime = when (ext) {
                "jpg", "jpeg" -> "image/jpeg"
                "png" -> "image/png"
                "mp4" -> "video/mp4"
                "ogg" -> "audio/ogg"
                "pdf" -> "application/pdf"
                else -> "application/octet-stream"
            }
            assertEquals(expected, mime)
        }
    }
}
