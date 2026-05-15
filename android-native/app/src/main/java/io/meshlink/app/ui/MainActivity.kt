package io.meshlink.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.data.RoomEntity
import io.meshlink.app.network.MatrixApi
import kotlinx.coroutines.launch

/**
 * Main screen — list of chat rooms.
 * Rooms loaded from server and cached in local SQLite.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var tvEmpty: TextView
    private lateinit var adapter: RoomListAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        recyclerView = findViewById(R.id.rvRooms)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        tvEmpty = findViewById(R.id.tvEmpty)

        adapter = RoomListAdapter { room ->
            val intent = Intent(this, ChatActivity::class.java)
            intent.putExtra("room_id", room.roomId)
            intent.putExtra("room_name", room.name)
            startActivity(intent)
        }

        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        swipeRefresh.setOnRefreshListener { loadRooms() }

        // Logout button
        findViewById<View>(R.id.btnLogout)?.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        // New chat button
        findViewById<View>(R.id.btnNewChat)?.setOnClickListener {
            startActivity(Intent(this, CreateChatActivity::class.java))
        }

        loadRooms()
    }

    private fun loadRooms() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        lifecycleScope.launch {
            // Show cached rooms first
            val cached = app.database.roomDao().getAll()
            if (cached.isNotEmpty()) {
                adapter.submitList(cached)
                tvEmpty.visibility = View.GONE
            }

            // Fetch from server
            try {
                val roomIds = app.matrixApi.getJoinedRooms(token)
                val rooms = mutableListOf<RoomEntity>()

                for (id in roomIds) {
                    try {
                        val info = app.matrixApi.getRoomState(id, token)
                        // Skip internal Meshlink rooms
                        if (info.name.contains("Meshlink") && (
                            info.name.contains("Shorts") || info.name.contains("Videos") ||
                            info.name.contains("Music") || info.name.contains("Registry") ||
                            info.name.contains("Marketplace"))) continue

                        rooms.add(RoomEntity(
                            roomId = id,
                            name = info.name,
                            avatarUrl = info.avatarUrl,
                            topic = info.topic
                        ))
                    } catch (_: Exception) {
                        rooms.add(RoomEntity(roomId = id, name = id.take(20)))
                    }
                }

                // Save to local DB
                app.database.roomDao().upsertAll(rooms)

                // Update UI
                adapter.submitList(rooms)
                tvEmpty.visibility = if (rooms.isEmpty()) View.VISIBLE else View.GONE
            } catch (e: Exception) {
                // Show cached data on error
                if (cached.isEmpty()) {
                    tvEmpty.text = "Connection error: ${e.message}"
                    tvEmpty.visibility = View.VISIBLE
                }
            }

            swipeRefresh.isRefreshing = false
        }
    }
}
