package io.meshlink.app.util

import android.content.Context
import android.content.SharedPreferences
import androidx.appcompat.app.AppCompatDelegate

/**
 * Theme manager — dark/light mode support.
 * Persists user preference.
 */
object ThemeManager {

    private const val PREFS_NAME = "meshlink_theme"
    private const val KEY_THEME = "theme_mode"

    const val THEME_DARK = "dark"
    const val THEME_LIGHT = "light"
    const val THEME_SYSTEM = "system"

    fun init(context: Context) {
        val theme = getTheme(context)
        applyTheme(theme)
    }

    fun getTheme(context: Context): String {
        return getPrefs(context).getString(KEY_THEME, THEME_DARK) ?: THEME_DARK
    }

    fun setTheme(context: Context, theme: String) {
        getPrefs(context).edit().putString(KEY_THEME, theme).apply()
        applyTheme(theme)
    }

    private fun applyTheme(theme: String) {
        when (theme) {
            THEME_DARK -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            THEME_LIGHT -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            THEME_SYSTEM -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        }
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
