package io.meshlink.app.ui

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.launch
import java.io.File

/**
 * Full-screen image viewer — zoom, pan, save, share.
 */
class ImageViewerActivity : AppCompatActivity() {

    private lateinit var imageView: ImageView
    private lateinit var tvTitle: TextView
    private var mxcUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_image_viewer)

        imageView = findViewById(R.id.imageView)
        tvTitle = findViewById(R.id.tvTitle)

        mxcUrl = intent.getStringExtra("mxc_url")
        val httpUrl = intent.getStringExtra("http_url")
        val title = intent.getStringExtra("title") ?: "Image"

        tvTitle.text = title
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        findViewById<View>(R.id.btnSave)?.setOnClickListener { saveImage() }

        if (httpUrl != null) {
            imageView.load(httpUrl) {
                crossfade(true)
                error(android.R.drawable.ic_menu_gallery)
            }
        }
    }

    private fun saveImage() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val url = mxcUrl ?: return

        lifecycleScope.launch {
            try {
                val mediaManager = MediaManager(this@ImageViewerActivity, app.database, app.securePrefs.serverUrl ?: "")
                val file = mediaManager.getMedia(url, token)
                if (file != null) {
                    Toast.makeText(this@ImageViewerActivity, "Saved to ${file.absolutePath}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@ImageViewerActivity, "Save failed", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
