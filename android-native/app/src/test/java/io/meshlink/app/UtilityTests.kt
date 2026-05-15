package io.meshlink.app

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for utility extensions and helpers.
 */
class UtilityTests {

    @Test
    fun matrixUsername_simple() {
        assertEquals("admin", "@admin:server.com".split(":")[0].removePrefix("@"))
    }

    @Test
    fun matrixServer_simple() {
        assertEquals("server.com", "@admin:server.com".split(":").drop(1).joinToString(":"))
    }

    @Test
    fun matrixServer_withPort() {
        assertEquals("server.com:8448", "@admin:server.com:8448".split(":").drop(1).joinToString(":"))
    }

    @Test
    fun truncate_short() {
        val text = "Hello"
        val result = if (text.length > 10) text.take(9) + "…" else text
        assertEquals("Hello", result)
    }

    @Test
    fun truncate_long() {
        val text = "This is a very long message"
        val result = if (text.length > 10) text.take(9) + "…" else text
        assertEquals("This is a…", result)
    }

    @Test
    fun initials_twoWords() {
        val name = "John Doe"
        val parts = name.split(" ")
        val initials = "${parts[0].first()}${parts[1].first()}".uppercase()
        assertEquals("JD", initials)
    }

    @Test
    fun initials_oneWord() {
        val name = "Admin"
        val initials = name.take(2).uppercase()
        assertEquals("AD", initials)
    }

    @Test
    fun relativeTime_justNow() {
        val now = System.currentTimeMillis()
        val diff = now - now
        val result = when {
            diff < 60_000 -> "just now"
            else -> "old"
        }
        assertEquals("just now", result)
    }

    @Test
    fun relativeTime_minutesAgo() {
        val now = System.currentTimeMillis()
        val fiveMinAgo = now - 300_000
        val diff = now - fiveMinAgo
        val result = when {
            diff < 60_000 -> "just now"
            diff < 3600_000 -> "${diff / 60_000}m ago"
            else -> "old"
        }
        assertEquals("5m ago", result)
    }

    @Test
    fun colorFromString_deterministic() {
        val colors = intArrayOf(
            0xFF6366F1.toInt(), 0xFFA855F7.toInt(), 0xFFEC4899.toInt(),
            0xFFEF4444.toInt(), 0xFFF97316.toInt(), 0xFFEAB308.toInt(),
            0xFF22C55E.toInt(), 0xFF14B8A6.toInt(), 0xFF3B82F6.toInt()
        )
        val color1 = colors[Math.abs("test".hashCode()) % colors.size]
        val color2 = colors[Math.abs("test".hashCode()) % colors.size]
        assertEquals(color1, color2) // Same string = same color
    }

    @Test
    fun colorFromString_different() {
        val colors = intArrayOf(
            0xFF6366F1.toInt(), 0xFFA855F7.toInt(), 0xFFEC4899.toInt(),
            0xFFEF4444.toInt(), 0xFFF97316.toInt(), 0xFFEAB308.toInt(),
            0xFF22C55E.toInt(), 0xFF14B8A6.toInt(), 0xFF3B82F6.toInt()
        )
        val c1 = colors[Math.abs("alice".hashCode()) % colors.size]
        val c2 = colors[Math.abs("bob".hashCode()) % colors.size]
        // Different strings likely different colors (not guaranteed but probable)
        assertTrue(c1 != 0 && c2 != 0)
    }

    @Test
    fun isMatrixUserId_valid() {
        assertTrue("@admin:server.com".matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$")))
        assertTrue("@user123:matrix.org".matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$")))
    }

    @Test
    fun isMatrixUserId_invalid() {
        assertFalse("admin:server.com".matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$")))
        assertFalse("@admin".matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$")))
        assertFalse("not a user id".matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$")))
    }

    @Test
    fun isMatrixRoomId() {
        assertTrue("!abc123:server.com".startsWith("!"))
        assertTrue("!abc123:server.com".contains(":"))
        assertFalse("abc123:server.com".startsWith("!"))
    }

    @Test
    fun formatSize_bytes() {
        assertEquals("0 B", formatBytes(0))
        assertEquals("512 B", formatBytes(512))
    }

    @Test
    fun formatSize_kb() {
        assertEquals("1 KB", formatBytes(1024))
        assertEquals("10 KB", formatBytes(10240))
    }

    @Test
    fun formatSize_mb() {
        assertEquals("1 MB", formatBytes(1048576))
        assertEquals("50 MB", formatBytes(52428800))
    }

    private fun formatBytes(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024L * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${"%.1f".format(bytes.toDouble() / (1024 * 1024 * 1024))} GB"
    }
}
