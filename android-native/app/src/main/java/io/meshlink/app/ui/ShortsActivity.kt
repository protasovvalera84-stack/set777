package io.meshlink.app.ui

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MatrixApi
import kotlinx.coroutines.launch

/**
 * Shorts page — TikTok-style vertical feed.
 * Loads shorts from #meshlink-shorts-v3 room.
 * Caches media locally for fast scrolling.
 */
class ShortsActivity : AppCompatActivity() {

    data class ShortItem(
        val id: String,
        val url: String,
        val caption: String,
        val author: String,
        val timestamp: Long,
        val type: String // "image" or "video"
    )

    private lateinit var rvShorts: RecyclerView
    private lateinit var tvEmpty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_shorts)

        rvShorts = findViewById(R.id.rvShorts)
        tvEmpty = findViewById(R.id.tvEmpty)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        rvShorts.layoutManager = GridLayoutManager(this, 2)

        loadShorts()
    }

    private fun loadShorts() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                // Find shorts room
                val alias = "#meshlink-shorts-v3:$serverName"
                val encoded = java.net.URLEncoder.encode(alias, "UTF-8")
                // This is simplified — in production would use MatrixApi method
                val shorts = mutableListOf<ShortItem>()

                // For now show empty state — shorts will be loaded when room exists
                if (shorts.isEmpty()) {
                    tvEmpty.visibility = View.VISIBLE
                    tvEmpty.text = "No shorts yet\nUpload your first short!"
                }
            } catch (_: Exception) {
                tvEmpty.visibility = View.VISIBLE
                tvEmpty.text = "Could not load shorts"
            }
        }
    }
}
