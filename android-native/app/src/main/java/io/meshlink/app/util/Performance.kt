package io.meshlink.app.util

import android.os.SystemClock
import android.util.Log

/**
 * Performance monitor — tracks app performance metrics.
 * Measures startup time, sync speed, render time.
 */
object PerformanceMonitor {

    private val timers = mutableMapOf<String, Long>()
    private val metrics = mutableMapOf<String, MutableList<Long>>()
    private const val TAG = "MeshlinkPerf"

    /** Start a timer */
    fun startTimer(name: String) {
        timers[name] = SystemClock.elapsedRealtime()
    }

    /** Stop timer and record duration */
    fun stopTimer(name: String): Long {
        val start = timers.remove(name) ?: return 0
        val duration = SystemClock.elapsedRealtime() - start
        metrics.getOrPut(name) { mutableListOf() }.add(duration)
        if (duration > 1000) Log.w(TAG, "$name took ${duration}ms (slow)")
        return duration
    }

    /** Get average time for a metric */
    fun getAverage(name: String): Long {
        val list = metrics[name] ?: return 0
        return if (list.isEmpty()) 0 else list.sum() / list.size
    }

    /** Get all metrics as formatted string */
    fun getReport(): String {
        return buildString {
            appendLine("=== Performance Report ===")
            for ((name, times) in metrics) {
                val avg = times.sum() / times.size
                val max = times.maxOrNull() ?: 0
                val min = times.minOrNull() ?: 0
                appendLine("$name: avg=${avg}ms min=${min}ms max=${max}ms (${times.size} samples)")
            }
        }
    }

    /** Clear all metrics */
    fun clear() {
        timers.clear()
        metrics.clear()
    }

    /** Get memory usage */
    fun getMemoryUsage(): String {
        val runtime = Runtime.getRuntime()
        val used = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
        val total = runtime.maxMemory() / (1024 * 1024)
        return "${used}MB / ${total}MB"
    }
}

/**
 * Rate limiter — prevents too many API calls.
 */
class RateLimiter(private val maxCalls: Int, private val periodMs: Long) {
    private val timestamps = mutableListOf<Long>()

    fun tryAcquire(): Boolean {
        val now = System.currentTimeMillis()
        timestamps.removeAll { now - it > periodMs }
        return if (timestamps.size < maxCalls) {
            timestamps.add(now)
            true
        } else false
    }

    fun reset() = timestamps.clear()
}

/**
 * Debouncer — delays execution until input stops.
 */
class Debouncer(private val delayMs: Long = 300) {
    private var job: kotlinx.coroutines.Job? = null

    fun debounce(scope: kotlinx.coroutines.CoroutineScope, action: suspend () -> Unit) {
        job?.cancel()
        job = scope.launch {
            kotlinx.coroutines.delay(delayMs)
            action()
        }
    }

    private fun kotlinx.coroutines.CoroutineScope.launch(block: suspend kotlinx.coroutines.CoroutineScope.() -> Unit): kotlinx.coroutines.Job {
        return kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { block() }
    }
}
