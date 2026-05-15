package io.meshlink.app.ui

import android.media.MediaPlayer
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.JsonParser
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Full Music player — browse tracks, play with background support.
 * Persistent player bar at bottom.
 */
class MusicPlayerActivity : AppCompatActivity() {

    data class Track(val id: String, val title: String, val author: String, val url: String, val mxcUrl: String)

    private lateinit var rvTracks: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var playerBar: View
    private lateinit var tvNowPlaying: TextView
    private lateinit var btnPlayPause: ImageButton
    private lateinit var seekBar: SeekBar

    private val tracks = mutableListOf<Track>()
    private var mediaPlayer: MediaPlayer? = null
    private var currentTrack: Track? = null
    private var isPlaying = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_music_player)

        rvTracks = findViewById(R.id.rvTracks)
        tvEmpty = findViewById(R.id.tvEmpty)
        playerBar = findViewById(R.id.playerBar)
        tvNowPlaying = findViewById(R.id.tvNowPlaying)
        btnPlayPause = findViewById(R.id.btnPlayPause)
        seekBar = findViewById(R.id.seekBar)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        btnPlayPause.setOnClickListener { togglePlayPause() }

        playerBar.visibility = View.GONE
        rvTracks.layoutManager = LinearLayoutManager(this)

        loadTracks()
    }

    private fun loadTracks() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val serverName = app.securePrefs.userId?.split(":")?.getOrNull(1) ?: return

        lifecycleScope.launch {
            try {
                val aliasResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/directory/room/${java.net.URLEncoder.encode("#meshlink-music:$serverName", "UTF-8")}")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                if (!aliasResp.isSuccessful) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "No music yet"; return@launch }
                val roomId = JsonParser.parseString(aliasResp.body?.string() ?: "{}").asJsonObject.get("room_id")?.asString ?: return@launch

                val msgResp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/${java.net.URLEncoder.encode(roomId, "UTF-8")}/messages?dir=b&limit=100")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                tracks.clear()
                val json = JsonParser.parseString(msgResp.body?.string() ?: "{}").asJsonObject
                json.getAsJsonArray("chunk")?.forEach { evt ->
                    val obj = evt.asJsonObject
                    val c = obj.getAsJsonObject("content") ?: return@forEach
                    val mxcUrl = c.get("url")?.asString ?: return@forEach
                    val httpUrl = app.matrixApi.mxcToHttp(mxcUrl) ?: return@forEach
                    tracks.add(Track(
                        id = obj.get("event_id")?.asString ?: "",
                        title = c.get("title")?.asString ?: c.get("body")?.asString ?: "Track",
                        author = obj.get("sender")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                        url = httpUrl, mxcUrl = mxcUrl
                    ))
                }
                tvEmpty.visibility = if (tracks.isEmpty()) View.VISIBLE else View.GONE
                rvTracks.adapter = TrackAdapter(tracks) { track -> playTrack(track) }
            } catch (e: Exception) { tvEmpty.visibility = View.VISIBLE; tvEmpty.text = "Error: ${e.message}" }
        }
    }

    private fun playTrack(track: Track) {
        mediaPlayer?.release()
        currentTrack = track
        tvNowPlaying.text = "${track.title} — ${track.author}"
        playerBar.visibility = View.VISIBLE

        try {
            mediaPlayer = MediaPlayer().apply {
                setDataSource(track.url)
                prepareAsync()
                setOnPreparedListener { mp ->
                    mp.start()
                    isPlaying = true
                    btnPlayPause.setImageResource(android.R.drawable.ic_media_pause)
                    seekBar.max = mp.duration
                    updateSeekBar()
                }
                setOnCompletionListener {
                    isPlaying = false
                    btnPlayPause.setImageResource(android.R.drawable.ic_media_play)
                    // Auto-play next
                    val idx = tracks.indexOf(track)
                    if (idx >= 0 && idx < tracks.size - 1) playTrack(tracks[idx + 1])
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Playback error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun togglePlayPause() {
        val mp = mediaPlayer ?: return
        if (isPlaying) { mp.pause(); isPlaying = false; btnPlayPause.setImageResource(android.R.drawable.ic_media_play) }
        else { mp.start(); isPlaying = true; btnPlayPause.setImageResource(android.R.drawable.ic_media_pause) }
    }

    private fun updateSeekBar() {
        val mp = mediaPlayer ?: return
        seekBar.postDelayed(object : Runnable {
            override fun run() {
                if (isPlaying && mediaPlayer != null) {
                    try { seekBar.progress = mediaPlayer!!.currentPosition } catch (_: Exception) {}
                    seekBar.postDelayed(this, 500)
                }
            }
        }, 500)
    }

    override fun onDestroy() {
        mediaPlayer?.release(); mediaPlayer = null
        super.onDestroy()
    }
}

class TrackAdapter(private val tracks: List<MusicPlayerActivity.Track>, private val onPlay: (MusicPlayerActivity.Track) -> Unit) : RecyclerView.Adapter<TrackAdapter.VH>() {
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }
    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int) = VH(android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false))
    override fun onBindViewHolder(holder: VH, position: Int) {
        val t = tracks[position]
        holder.tvName.text = t.title; holder.tvLastMessage.text = t.author; holder.tvAvatar.text = "♪"
        holder.itemView.setOnClickListener { onPlay(t) }
    }
    override fun getItemCount() = tracks.size
}
