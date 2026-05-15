package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.PagerSnapHelper
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import com.google.gson.JsonParser
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Full Shorts platform — TikTok-style vertical scroll feed.
 * Record video, upload, browse, like, comment.
 */
class ShortsFullActivity : AppCompatActivity() {

    data class ShortItem(
        val id: String, val url: String, val caption: String,
        val author: String, val authorId: String, val type: String,
        val timestamp: Long, var likes: Int = 0, var liked: Boolean = false
    )

    private lateinit var rvFeed: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var btnUpload: ImageButton
    private lateinit var tabForYou: TextView
    private lateinit var tabFriends: TextView
    private val shorts = mutableListOf<ShortItem>()
    private var currentTab = "foryou"
    private var cameraFile: File? = null

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.CaptureVideo()) { success ->
        if (success && cameraFile != null) uploadShort(Uri.fromFile(cameraFile), "video")
    }
    private val galleryLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val mime = contentResolver.getType(uri) ?: ""
            uploadShort(uri, if (mime.startsWith("video")) "video" else "image")
        }
    }
    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_shorts_full)

        rvFeed = findViewById(R.id.rvFeed)
        tvEmpty = findViewById(R.id.tvEmpty)
        btnUpload = findViewById(R.id.btnUpload)
        tabForYou = findViewById(R.id.tabForYou)
        tabFriends = findViewById(R.id.tabFriends)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        // Vertical snap scroll (TikTok style)
        val layoutManager = LinearLayoutManager(this)
        rvFeed.layoutManager = layoutManager
        PagerSnapHelper().attachToRecyclerView(rvFeed)

        tabForYou.setOnClickListener { currentTab = "foryou"; loadShorts(); updateTabs() }
        tabFriends.setOnClickListener { currentTab = "friends"; loadShorts(); updateTabs() }

        btnUpload.setOnClickListener { showUploadOptions() }

        loadShorts()
    }

    private fun updateTabs() {
        tabForYou.setTextColor(if (currentTab == "foryou") 0xFFFFFFFF.toInt() else 0x88FFFFFF.toInt())
        tabFriends.setTextColor(if (currentTab == "friends") 0xFFFFFFFF.toInt() else 0x88FFFFFF.toInt())
    }

    private fun showUploadOptions() {
        val options = arrayOf("Record Video", "Choose from Gallery")
        android.app.AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("Upload Short")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> recordVideo()
                    1 -> galleryLauncher.launch("*/*")
                }
            }.show()
    }

    private fun recordVideo() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permLauncher.launch(Manifest.permission.CAMERA); return
        }
        val dir = File(filesDir, ".meshlink_camera").also { it.mkdirs() }
        cameraFile = File(dir, "short_${System.currentTimeMillis()}.mp4")
        val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", cameraFile!!)
        cameraLauncher.launch(uri)
    }

    private fun uploadShort(uri: Uri, type: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                Toast.makeText(this@ShortsFullActivity, "Uploading...", Toast.LENGTH_SHORT).show()
                val tempFile = withContext(Dispatchers.IO) {
                    val input = contentResolver.openInputStream(uri) ?: return@withContext null
                    val file = File(cacheDir, "short_upload_${System.currentTimeMillis()}")
                    file.outputStream().use { out -> input.copyTo(out) }; file
                } ?: return@launch

                val mediaManager = MediaManager(this@ShortsFullActivity, app.database, baseUrl)
                val mxcUrl = mediaManager.uploadMedia(tempFile, token) ?: return@launch
                val httpUrl = app.matrixApi.mxcToHttp(mxcUrl) ?: mxcUrl

                // Find or create shorts room
                val alias = "#meshlink-shorts-v3:$serverName"
                var roomId: String? = null
                withContext(Dispatchers.IO) {
                    val resp = okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode(alias, "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                    if (resp.isSuccessful) roomId = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString
                }
                if (roomId == null) return@launch

                // Post short
                val txn = "short${System.currentTimeMillis()}"
                val body = Gson().toJson(mapOf("url" to httpUrl, "mediaType" to type, "caption" to "", "visibility" to "everyone"))
                withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId!!, "UTF-8")}/send/org.meshlink.short_post/$txn")
                        .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                        .put(body)).build()).execute(.toRequestBody("application/json".toMediaType())
                }
                tempFile.delete()
                Toast.makeText(this@ShortsFullActivity, "Posted!", Toast.LENGTH_SHORT).show()
                loadShorts()
            } catch (e: Exception) { Toast.makeText(this@ShortsFullActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show() }
        }
    }

    private fun loadShorts() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val alias = "#meshlink-shorts-v3:$serverName"
                val aliasResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode(alias, "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No shorts yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val msgResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=50")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                shorts.clear()
                val json = JsonParser.parseString(msgResp.body?.string() ?: "{}").asJsonObject
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    if (obj.get("type")?.asString == "org.meshlink.short_post") {
                        val c = obj.getAsJsonObject("content") ?: return@forEach
                        shorts.add(ShortItem(
                            id = obj.get("event_id")?.asString ?: "", url = c.get("url")?.asString ?: "",
                            caption = c.get("caption")?.asString ?: "",
                            author = obj.get("sender")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                            authorId = obj.get("sender")?.asString ?: "",
                            type = c.get("mediaType")?.asString ?: "image",
                            timestamp = obj.get("origin_server_ts")?.asLong ?: 0
                        ))
                    }
                }
                tvEmpty.visibility = if (shorts.isEmpty()) View.VISIBLE else View.GONE
                rvFeed.adapter = ShortsFeedAdapter(shorts)
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }
}

class ShortsFeedAdapter(private val items: List<ShortsFullActivity.ShortItem>) : RecyclerView.Adapter<ShortsFeedAdapter.VH>() {
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAuthor: TextView = view.findViewById(R.id.tvShortAuthor)
        val tvCaption: TextView = view.findViewById(R.id.tvShortCaption)
        val tvLikes: TextView = view.findViewById(R.id.tvShortLikes)
        val btnLike: ImageButton = view.findViewById(R.id.btnShortLike)
    }
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        return VH(LayoutInflater.from(parent.context).inflate(R.layout.item_short, parent, false))
    }
    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvAuthor.text = "@${item.author}"
        holder.tvCaption.text = item.caption
        holder.tvLikes.text = "${item.likes}"
        holder.btnLike.setOnClickListener {
            item.liked = !item.liked
            item.likes += if (item.liked) 1 else -1
            holder.tvLikes.text = "${item.likes}"
            holder.btnLike.alpha = if (item.liked) 1f else 0.5f
        }
    }
    override fun getItemCount() = items.size
}
