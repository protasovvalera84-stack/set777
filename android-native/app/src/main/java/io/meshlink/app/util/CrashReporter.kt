package io.meshlink.app.util

import android.content.Context
import android.util.Log

/**
 * Crash reporter — catches unhandled exceptions.
 * Saves crash logs to local file for debugging.
 */
class CrashReporter(private val context: Context) : Thread.UncaughtExceptionHandler {

    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    private val tag = "MeshlinkCrash"

    fun install() {
        Thread.setDefaultUncaughtExceptionHandler(this)
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            val report = buildString {
                appendLine("=== Meshlink Crash Report ===")
                appendLine("Time: ${java.util.Date()}")
                appendLine("Thread: ${thread.name}")
                appendLine("Exception: ${throwable.javaClass.name}")
                appendLine("Message: ${throwable.message}")
                appendLine()
                appendLine("Stack trace:")
                appendLine(throwable.stackTraceToString())
                appendLine()
                appendLine("Device: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
                appendLine("Android: ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT})")
                appendLine("Memory: ${PerformanceMonitor.getMemoryUsage()}")
            }

            // Save to file
            val file = java.io.File(context.filesDir, "crash_${System.currentTimeMillis()}.log")
            file.writeText(report)
            Log.e(tag, report)

            // Keep only last 10 crash logs
            val crashFiles = context.filesDir.listFiles { f -> f.name.startsWith("crash_") }
                ?.sortedByDescending { it.lastModified() } ?: emptyList()
            crashFiles.drop(10).forEach { it.delete() }

        } catch (_: Exception) {}

        // Pass to default handler
        defaultHandler?.uncaughtException(thread, throwable)
    }

    /** Get all crash logs */
    fun getCrashLogs(): List<String> {
        return context.filesDir.listFiles { f -> f.name.startsWith("crash_") }
            ?.sortedByDescending { it.lastModified() }
            ?.map { it.readText() }
            ?: emptyList()
    }

    /** Get last crash log */
    fun getLastCrash(): String? {
        return context.filesDir.listFiles { f -> f.name.startsWith("crash_") }
            ?.maxByOrNull { it.lastModified() }
            ?.readText()
    }

    /** Clear all crash logs */
    fun clearCrashLogs() {
        context.filesDir.listFiles { f -> f.name.startsWith("crash_") }
            ?.forEach { it.delete() }
    }
}

/**
 * Logger — structured logging with levels.
 */
object MeshlinkLogger {
    private const val TAG = "Meshlink"
    var isDebug = true

    fun d(message: String) { if (isDebug) Log.d(TAG, message) }
    fun i(message: String) { Log.i(TAG, message) }
    fun w(message: String) { Log.w(TAG, message) }
    fun e(message: String, throwable: Throwable? = null) {
        if (throwable != null) Log.e(TAG, message, throwable)
        else Log.e(TAG, message)
    }

    fun network(method: String, url: String, status: Int) {
        if (isDebug) Log.d(TAG, "[$method] $url → $status")
    }

    fun perf(operation: String, durationMs: Long) {
        if (durationMs > 500) Log.w(TAG, "SLOW: $operation took ${durationMs}ms")
        else if (isDebug) Log.d(TAG, "$operation: ${durationMs}ms")
    }
}
