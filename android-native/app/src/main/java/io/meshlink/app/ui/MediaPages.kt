package io.meshlink.app.ui

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import com.google.gson.JsonParser
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Video page — browse and upload videos.
 * Videos stored in #meshlink-videos room.
 */
class VideoActivity : AppCompatActivity() {

    data class VideoItem(val id: String, val url: String, val title: String, val author: String, val timestamp: Long)

    private lateinit var rvVideos: RecyclerView
    private lateinit var tvEmpty: TextView
    private val videos = mutableListOf<VideoItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_media_list)
        findViewById<TextView>(R.id.tvPageTitle)?.text = "Videos"
        rvVideos = findViewById(R.id.rvItems)
        tvEmpty = findViewById(R.id.tvEmpty)
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        rvVideos.layoutManager = LinearLayoutManager(this)
        loadItems("meshlink-videos", "org.meshlink.video")
    }

    private fun loadItems(alias: String, eventType: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val aliasResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode("#$alias:$serverName", "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No videos yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body()?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val msgResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=50")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                val json = JsonParser.parseString(msgResp.body()?.string() ?: "{}").asJsonObject
                videos.clear()
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    if (obj.get("type")?.asString == eventType || obj.get("type")?.asString == "m.room.message") {
                        val c = obj.getAsJsonObject("content") ?: return@forEach
                        val url = c.get("url")?.asString ?: c.get("body")?.asString ?: return@forEach
                        videos.add(VideoItem(
                            id = obj.get("event_id")?.asString ?: "",
                            url = url, title = c.get("title")?.asString ?: c.get("body")?.asString ?: "Video",
                            author = obj.get("sender")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                            timestamp = obj.get("origin_server_ts")?.asLong ?: 0
                        ))
                    }
                }
                tvEmpty.visibility = if (videos.isEmpty()) View.VISIBLE else View.GONE
                tvEmpty.text = "No videos yet"
                rvVideos.adapter = MediaListAdapter(videos.map { MediaListAdapter.Item(it.id, it.title, it.author, it.timestamp) })
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }
}

/**
 * Music page — browse and upload music.
 */
class MusicActivity : AppCompatActivity() {
    private lateinit var rvItems: RecyclerView
    private lateinit var tvEmpty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_media_list)
        findViewById<TextView>(R.id.tvPageTitle)?.text = "Music"
        rvItems = findViewById(R.id.rvItems)
        tvEmpty = findViewById(R.id.tvEmpty)
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        rvItems.layoutManager = LinearLayoutManager(this)
        loadMusic()
    }

    private fun loadMusic() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val aliasResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode("#meshlink-music:$serverName", "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No music yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body()?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val items = mutableListOf<MediaListAdapter.Item>()
                val msgResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=50")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                val json = JsonParser.parseString(msgResp.body()?.string() ?: "{}").asJsonObject
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    val c = obj.getAsJsonObject("content") ?: return@forEach
                    items.add(MediaListAdapter.Item(
                        obj.get("event_id")?.asString ?: "",
                        c.get("title")?.asString ?: c.get("body")?.asString ?: "Track",
                        obj.get("sender")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                        obj.get("origin_server_ts")?.asLong ?: 0
                    ))
                }
                tvEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
                rvItems.adapter = MediaListAdapter(items)
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }
}

/**
 * Marketplace page — buy/sell/trade.
 */
class MarketActivity : AppCompatActivity() {
    private lateinit var rvItems: RecyclerView
    private lateinit var tvEmpty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_media_list)
        findViewById<TextView>(R.id.tvPageTitle)?.text = "Marketplace"
        rvItems = findViewById(R.id.rvItems)
        tvEmpty = findViewById(R.id.tvEmpty)
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        rvItems.layoutManager = LinearLayoutManager(this)
        loadListings()
    }

    private fun loadListings() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val aliasResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode("#meshlink-market:$serverName", "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No listings yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body()?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val items = mutableListOf<MediaListAdapter.Item>()
                val msgResp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=50")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                val json = JsonParser.parseString(msgResp.body()?.string() ?: "{}").asJsonObject
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    if (obj.get("type")?.asString == "org.meshlink.listing") {
                        val c = obj.getAsJsonObject("content") ?: return@forEach
                        items.add(MediaListAdapter.Item(
                            obj.get("event_id")?.asString ?: "",
                            "${c.get("currency")?.asString ?: "$"}${c.get("price")?.asString ?: "0"} — ${c.get("title")?.asString ?: "Item"}",
                            obj.get("sender")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                            obj.get("origin_server_ts")?.asLong ?: 0
                        ))
                    }
                }
                tvEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
                rvItems.adapter = MediaListAdapter(items)
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }
}

/** Reusable adapter for media/listing items */
class MediaListAdapter(private val items: List<Item>) : RecyclerView.Adapter<MediaListAdapter.VH>() {
    data class Item(val id: String, val title: String, val author: String, val timestamp: Long)
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }
    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): VH {
        return VH(android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false))
    }
    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvName.text = item.title
        holder.tvLastMessage.text = "${item.author} · ${java.text.SimpleDateFormat("dd.MM", java.util.Locale.getDefault()).format(java.util.Date(item.timestamp))}"
        holder.tvAvatar.text = item.title.take(2).uppercase()
    }
    override fun getItemCount() = items.size
}
