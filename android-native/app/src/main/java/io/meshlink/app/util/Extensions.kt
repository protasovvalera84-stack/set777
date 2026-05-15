package io.meshlink.app.util

import android.app.Activity
import android.content.Context
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.*

/**
 * Extension functions and helpers used across the app.
 */

/** Hide keyboard */
fun Activity.hideKeyboard() {
    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    currentFocus?.let { imm.hideSoftInputFromWindow(it.windowToken, 0) }
}

/** Show keyboard */
fun View.showKeyboard() {
    requestFocus()
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    imm.showSoftInput(this, InputMethodManager.SHOW_IMPLICIT)
}

/** Short toast */
fun Context.toast(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}

/** Long toast */
fun Context.toastLong(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}

/** Format timestamp to time string (HH:mm) */
fun Long.toTimeString(): String {
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(this))
}

/** Format timestamp to date string (dd.MM.yyyy) */
fun Long.toDateString(): String {
    return SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date(this))
}

/** Format timestamp to relative time (just now, 5m ago, 2h ago, yesterday) */
fun Long.toRelativeTime(): String {
    val now = System.currentTimeMillis()
    val diff = now - this
    return when {
        diff < 60_000 -> "just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        diff < 172800_000 -> "yesterday"
        else -> toDateString()
    }
}

/** Extract username from Matrix user ID (@user:server) */
fun String.matrixUsername(): String {
    return split(":").firstOrNull()?.removePrefix("@") ?: this
}

/** Extract server from Matrix user ID */
fun String.matrixServer(): String {
    return split(":").drop(1).joinToString(":")
}

/** Truncate string with ellipsis */
fun String.truncate(maxLength: Int): String {
    return if (length > maxLength) take(maxLength - 1) + "…" else this
}

/** Get initials from name (max 2 chars) */
fun String.initials(): String {
    val parts = trim().split(" ").filter { it.isNotEmpty() }
    return when {
        parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
        isNotEmpty() -> take(2).uppercase()
        else -> "?"
    }
}

/** Generate color from string (for avatars) */
fun String.toColor(): Int {
    val hash = hashCode()
    val colors = intArrayOf(
        0xFF6366F1.toInt(), 0xFFA855F7.toInt(), 0xFFEC4899.toInt(),
        0xFFEF4444.toInt(), 0xFFF97316.toInt(), 0xFFEAB308.toInt(),
        0xFF22C55E.toInt(), 0xFF14B8A6.toInt(), 0xFF3B82F6.toInt()
    )
    return colors[Math.abs(hash) % colors.size]
}

/** Check if string is valid Matrix user ID */
fun String.isMatrixUserId(): Boolean {
    return matches(Regex("^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$"))
}

/** Check if string is valid Matrix room ID */
fun String.isMatrixRoomId(): Boolean {
    return startsWith("!") && contains(":")
}

/** Check if string is valid Matrix room alias */
fun String.isMatrixRoomAlias(): Boolean {
    return startsWith("#") && contains(":")
}

/** Safely parse JSON or return null */
fun String.safeParseJson(): com.google.gson.JsonObject? {
    return try {
        com.google.gson.JsonParser.parseString(this).asJsonObject
    } catch (_: Exception) { null }
}
