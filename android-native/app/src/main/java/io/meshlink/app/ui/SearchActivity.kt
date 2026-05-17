package io.meshlink.app.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.data.RoomEntity
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import io.meshlink.app.network.RoomManager
import kotlinx.coroutines.launch

/**
 * Global search — search across rooms, messages, users, media.
 */
class SearchActivity : AppCompatActivity() {

    data class SearchResult(val type: String, val title: String, val subtitle: String, val id: String)

    private lateinit var etSearch: EditText
    private lateinit var rvResults: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var chipAll: TextView
    private lateinit var chipRooms: TextView
    private lateinit var chipMessages: TextView
    private lateinit var chipUsers: TextView
    private val results = mutableListOf<SearchResult>()
    private var currentFilter = "all"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_search)

        etSearch = findViewById(R.id.etSearch)
        rvResults = findViewById(R.id.rvResults)
        tvEmpty = findViewById(R.id.tvEmpty)
        chipAll = findViewById(R.id.chipAll)
        chipRooms = findViewById(R.id.chipRooms)
        chipMessages = findViewById(R.id.chipMessages)
        chipUsers = findViewById(R.id.chipUsers)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        rvResults.layoutManager = LinearLayoutManager(this)

        chipAll.setOnClickListener { currentFilter = "all"; search(etSearch.text.toString()) }
        chipRooms.setOnClickListener { currentFilter = "rooms"; search(etSearch.text.toString()) }
        chipMessages.setOnClickListener { currentFilter = "messages"; search(etSearch.text.toString()) }
        chipUsers.setOnClickListener { currentFilter = "users"; search(etSearch.text.toString()) }

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { search(s?.toString() ?: "") }
        })

        etSearch.requestFocus()
    }

    private fun search(query: String) {
        if (query.length < 2) { results.clear(); updateUI(); return }
        val q = query.lowercase()

        lifecycleScope.launch {
            val app = MeshlinkApp.instance
            results.clear()

            // Search rooms
            if (currentFilter == "all" || currentFilter == "rooms") {
                val rooms = app.database.roomDao().getAll()
                rooms.filter { it.name.lowercase().contains(q) }.forEach {
                    results.add(SearchResult("room", it.name, "${it.roomId.take(20)}...", it.roomId))
                }
            }

            // Search messages
            if (currentFilter == "all" || currentFilter == "messages") {
                val rooms = app.database.roomDao().getAll()
                for (room in rooms.take(10)) {
                    val msgs = app.database.messageDao().getByRoom(room.roomId, 50)
                    msgs.filter { it.body.lowercase().contains(q) }.take(5).forEach {
                        val sender = it.sender.split(":")[0].removePrefix("@")
                        results.add(SearchResult("message", it.body.take(60), "$sender in ${room.name}", room.roomId))
                    }
                }
            }

            // Search users
            if (currentFilter == "all" || currentFilter == "users") {
                val token = app.securePrefs.accessToken ?: return@launch
                try {
                    val resp = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                        val body = """{"search_term":"$query","limit":10}"""
                        okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                            .url("${app.securePrefs.serverUrl}/_matrix/client/v3/user_directory/search")
                            .addHeader("Authorization", "Bearer $token")
                            .addHeader("Content-Type", "application/json")
                            .post(body.toRequestBody("application/json".toMediaType()))
                            .build()).execute()
                    }
                    val json = com.google.gson.JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
                    json.getAsJsonArray("results")?.forEach { r ->
                        val obj = r.asJsonObject
                        val userId = obj.get("user_id")?.asString ?: return@forEach
                        val name = obj.get("display_name")?.asString ?: userId.split(":")[0].removePrefix("@")
                        results.add(SearchResult("user", name, userId, userId))
                    }
                } catch (_: Exception) {}
            }

            updateUI()
        }
    }

    private fun updateUI() {
        tvEmpty.visibility = if (results.isEmpty()) View.VISIBLE else View.GONE
        tvEmpty.text = if (etSearch.text.length < 2) "Type to search..." else "No results"

        // Update chip colors
        for ((chip, filter) in listOf(chipAll to "all", chipRooms to "rooms", chipMessages to "messages", chipUsers to "users")) {
            chip.setTextColor(if (currentFilter == filter) 0xFFFFFFFF.toInt() else 0xFF888888.toInt())
            chip.setBackgroundColor(if (currentFilter == filter) 0xFFA855F7.toInt() else 0x00000000)
        }

        rvResults.adapter = SearchResultAdapter(results) { result ->
            when (result.type) {
                "room", "message" -> {
                    val rooms = MeshlinkApp.instance.database.roomDao()
                    lifecycleScope.launch {
                        val room = rooms.getAll().find { it.roomId == result.id }
                        startActivity(Intent(this@SearchActivity, ChatActivity::class.java).apply {
                            putExtra("room_id", result.id)
                            putExtra("room_name", room?.name ?: result.title)
                        })
                    }
                }
                "user" -> {
                    startActivity(Intent(this, CreateChatActivity::class.java))
                }
            }
        }
    }
}

class SearchResultAdapter(
    private val items: List<SearchActivity.SearchResult>,
    private val onClick: (SearchActivity.SearchResult) -> Unit
) : RecyclerView.Adapter<SearchResultAdapter.VH>() {
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }
    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int) =
        VH(android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false))
    override fun onBindViewHolder(holder: VH, position: Int) {
        val r = items[position]
        holder.tvName.text = r.title
        holder.tvLastMessage.text = r.subtitle
        holder.tvAvatar.text = when (r.type) {
            "room" -> "💬"; "message" -> "📝"; "user" -> "👤"; else -> "?"
        }
        holder.itemView.setOnClickListener { onClick(r) }
    }
    override fun getItemCount() = items.size
}
