package io.meshlink.app

import org.junit.Assert.*
import org.junit.Test

/**
 * Performance and edge case tests.
 */
class PerformanceTests {

    // ===== Auto-updater version comparison =====

    @Test
    fun versionCompare_newer() {
        assertTrue(isNewer("1.1.0", "1.0.0"))
        assertTrue(isNewer("2.0.0", "1.9.9"))
        assertTrue(isNewer("1.0.1", "1.0.0"))
    }

    @Test
    fun versionCompare_same() {
        assertFalse(isNewer("1.0.0", "1.0.0"))
        assertFalse(isNewer("2.1.3", "2.1.3"))
    }

    @Test
    fun versionCompare_older() {
        assertFalse(isNewer("1.0.0", "1.1.0"))
        assertFalse(isNewer("1.0.0", "2.0.0"))
    }

    @Test
    fun versionCompare_differentLength() {
        assertTrue(isNewer("1.0.0.1", "1.0.0"))
        assertFalse(isNewer("1.0", "1.0.0"))
    }

    // ===== Rate limiter =====

    @Test
    fun rateLimiter_allows() {
        val limiter = io.meshlink.app.util.RateLimiter(5, 1000)
        repeat(5) { assertTrue(limiter.tryAcquire()) }
    }

    @Test
    fun rateLimiter_blocks() {
        val limiter = io.meshlink.app.util.RateLimiter(3, 60000)
        repeat(3) { assertTrue(limiter.tryAcquire()) }
        assertFalse(limiter.tryAcquire()) // 4th should be blocked
    }

    @Test
    fun rateLimiter_reset() {
        val limiter = io.meshlink.app.util.RateLimiter(1, 60000)
        assertTrue(limiter.tryAcquire())
        assertFalse(limiter.tryAcquire())
        limiter.reset()
        assertTrue(limiter.tryAcquire()) // Should work after reset
    }

    // ===== Performance monitor =====

    @Test
    fun perfMonitor_timer() {
        io.meshlink.app.util.PerformanceMonitor.clear()
        io.meshlink.app.util.PerformanceMonitor.startTimer("test")
        Thread.sleep(50)
        val duration = io.meshlink.app.util.PerformanceMonitor.stopTimer("test")
        assertTrue(duration >= 40) // At least 40ms (allowing some variance)
    }

    @Test
    fun perfMonitor_average() {
        io.meshlink.app.util.PerformanceMonitor.clear()
        // Simulate 3 measurements
        io.meshlink.app.util.PerformanceMonitor.startTimer("avg_test")
        Thread.sleep(10)
        io.meshlink.app.util.PerformanceMonitor.stopTimer("avg_test")

        io.meshlink.app.util.PerformanceMonitor.startTimer("avg_test")
        Thread.sleep(10)
        io.meshlink.app.util.PerformanceMonitor.stopTimer("avg_test")

        val avg = io.meshlink.app.util.PerformanceMonitor.getAverage("avg_test")
        assertTrue(avg > 0)
    }

    @Test
    fun perfMonitor_memory() {
        val mem = io.meshlink.app.util.PerformanceMonitor.getMemoryUsage()
        assertTrue(mem.contains("MB"))
    }

    @Test
    fun perfMonitor_report() {
        io.meshlink.app.util.PerformanceMonitor.clear()
        io.meshlink.app.util.PerformanceMonitor.startTimer("report_test")
        io.meshlink.app.util.PerformanceMonitor.stopTimer("report_test")
        val report = io.meshlink.app.util.PerformanceMonitor.getReport()
        assertTrue(report.contains("report_test"))
    }

    // ===== Large data handling =====

    @Test
    fun largeMessageList_sorting() {
        val messages = (1..1000).map {
            io.meshlink.app.data.MessageEntity(
                "e$it", "!room", "@user:s", "Message $it",
                timestamp = (Math.random() * 1000000).toLong()
            )
        }
        val sorted = messages.sortedBy { it.timestamp }
        for (i in 1 until sorted.size) {
            assertTrue(sorted[i].timestamp >= sorted[i - 1].timestamp)
        }
    }

    @Test
    fun largeRoomList_filtering() {
        val rooms = (1..500).map {
            io.meshlink.app.data.RoomEntity("!r$it", "Room $it", isDirect = it % 2 == 0)
        }
        val direct = rooms.filter { it.isDirect }
        assertEquals(250, direct.size)
    }

    @Test
    fun stringOperations_performance() {
        val start = System.currentTimeMillis()
        repeat(10000) {
            val userId = "@user$it:server.example.com"
            userId.split(":")[0].removePrefix("@")
        }
        val duration = System.currentTimeMillis() - start
        assertTrue("String ops took ${duration}ms", duration < 1000) // Should be fast
    }

    // ===== Edge cases =====

    @Test
    fun emptyRoom_handling() {
        val room = io.meshlink.app.data.RoomEntity("!empty", "")
        assertEquals("", room.name)
        assertNull(room.lastMessage)
    }

    @Test
    fun unicodeMessage() {
        val msg = io.meshlink.app.data.MessageEntity(
            "e1", "!r", "@u:s", "Привет мир! 🌍 こんにちは",
            timestamp = 0
        )
        assertTrue(msg.body.contains("Привет"))
        assertTrue(msg.body.contains("🌍"))
    }

    @Test
    fun veryLongMessage() {
        val longBody = "A".repeat(100000)
        val msg = io.meshlink.app.data.MessageEntity("e1", "!r", "@u:s", longBody, timestamp = 0)
        assertEquals(100000, msg.body.length)
    }

    private fun isNewer(server: String, current: String): Boolean {
        val s = server.split(".").map { it.toIntOrNull() ?: 0 }
        val c = current.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(s.size, c.size)) {
            val sv = s.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (sv > cv) return true
            if (sv < cv) return false
        }
        return false
    }
}
