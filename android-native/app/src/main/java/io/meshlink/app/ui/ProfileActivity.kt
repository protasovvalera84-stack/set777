package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonParser
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * User profile screen — view/edit display name, avatar, settings.
 */
class ProfileActivity : AppCompatActivity() {

    private lateinit var tvAvatar: TextView
    private lateinit var tvName: TextView
    private lateinit var tvUserId: TextView
    private lateinit var etDisplayName: EditText
    private lateinit var btnSave: Button
    private lateinit var btnLogout: Button
    private lateinit var tvCacheSize: TextView
    private lateinit var btnClearCache: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        tvAvatar = findViewById(R.id.tvAvatar)
        tvName = findViewById(R.id.tvName)
        tvUserId = findViewById(R.id.tvUserId)
        etDisplayName = findViewById(R.id.etDisplayName)
        btnSave = findViewById(R.id.btnSave)
        btnLogout = findViewById(R.id.btnLogout)
        tvCacheSize = findViewById(R.id.tvCacheSize)
        btnClearCache = findViewById(R.id.btnClearCache)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        val app = MeshlinkApp.instance
        val userId = app.securePrefs.userId ?: ""
        val name = userId.split(":")[0].removePrefix("@")

        tvUserId.text = userId
        tvName.text = name
        tvAvatar.text = name.take(2).uppercase()
        etDisplayName.setText(name)

        loadProfile()
        loadCacheSize()

        btnSave.setOnClickListener { saveProfile() }
        btnLogout.setOnClickListener { logout() }
        btnClearCache.setOnClickListener { clearCache() }
    }

    private fun loadProfile() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val userId = app.securePrefs.userId ?: return

        lifecycleScope.launch {
            try {
                val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/profile/$encoded")
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                val response = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(request).execute()
                }
                if (response.isSuccessful) {
                    val json = JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
                    val displayName = json.get("displayname")?.asString
                    if (displayName != null) {
                        tvName.text = displayName
                        tvAvatar.text = displayName.take(2).uppercase()
                        etDisplayName.setText(displayName)
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun saveProfile() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val userId = app.securePrefs.userId ?: return
        val newName = etDisplayName.text.toString().trim()
        if (newName.isEmpty()) return

        lifecycleScope.launch {
            try {
                val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
                val body = """{"displayname":"$newName"}"""
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/profile/$encoded/displayname")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .put(
                        "application/json".toMediaType(), body))
                    .build()
                withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(request).execute()
                }
                tvName.text = newName
                tvAvatar.text = newName.take(2).uppercase()
                Toast.makeText(this@ProfileActivity, "Profile updated", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@ProfileActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadCacheSize() {
        lifecycleScope.launch {
            val app = MeshlinkApp.instance
            val mediaManager = io.meshlink.app.network.MediaManager(
                this@ProfileActivity, app.database, app.securePrefs.serverUrl ?: ""
            )
            val size = mediaManager.getCacheSize()
            val mb = size / (1024 * 1024)
            tvCacheSize.text = "Cache: ${mb}MB"
        }
    }

    private fun clearCache() {
        lifecycleScope.launch {
            val app = MeshlinkApp.instance
            val mediaManager = io.meshlink.app.network.MediaManager(
                this@ProfileActivity, app.database, app.securePrefs.serverUrl ?: ""
            )
            mediaManager.clearCache()
            tvCacheSize.text = "Cache: 0MB"
            Toast.makeText(this@ProfileActivity, "Cache cleared", Toast.LENGTH_SHORT).show()
        }
    }

    private fun logout() {
        val app = MeshlinkApp.instance
        lifecycleScope.launch {
            try { app.matrixApi.logout(app.securePrefs.accessToken ?: "") } catch (_: Exception) {}
            app.securePrefs.clear()
            app.database.roomDao().deleteAll()
            app.database.messageDao().deleteAll()
            startActivity(Intent(this@ProfileActivity, LoginActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            finish()
        }
    }
}
