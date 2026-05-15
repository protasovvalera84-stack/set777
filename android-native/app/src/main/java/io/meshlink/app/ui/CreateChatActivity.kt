package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.app.AlertDialog
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * Create new chat — search users, create DM or group.
 */
class CreateChatActivity : AppCompatActivity() {

    private lateinit var etSearch: EditText
    private lateinit var rvResults: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var btnCreateGroup: Button
    private lateinit var progress: ProgressBar

    private val searchResults = mutableListOf<UserResult>()
    private lateinit var adapter: UserSearchAdapter
    private var searchJob: Job? = null

    data class UserResult(
        val userId: String,
        val displayName: String,
        val avatarUrl: String? = null
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_chat)

        etSearch = findViewById(R.id.etSearch)
        rvResults = findViewById(R.id.rvResults)
        tvEmpty = findViewById(R.id.tvEmpty)
        btnCreateGroup = findViewById(R.id.btnCreateGroup)
        progress = findViewById(R.id.progress)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        adapter = UserSearchAdapter(searchResults) { user ->
            createDirectChat(user)
        }
        rvResults.layoutManager = LinearLayoutManager(this)
        rvResults.adapter = adapter

        // Search with debounce
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchJob?.cancel()
                val query = s?.toString()?.trim() ?: ""
                if (query.length < 2) {
                    searchResults.clear()
                    adapter.notifyDataSetChanged()
                    tvEmpty.visibility = View.VISIBLE
                    tvEmpty.text = "Type to search users..."
                    return
                }
                searchJob = lifecycleScope.launch {
                    delay(300) // debounce
                    searchUsers(query)
                }
            }
        })

        btnCreateGroup.setOnClickListener { showCreateGroupDialog() }
    }

    private suspend fun searchUsers(query: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        progress.visibility = View.VISIBLE
        try {
            val body = """{"search_term":"$query","limit":20}"""
            val request = okhttp3.Request.Builder()
                .url("$baseUrl/_matrix/client/v3/user_directory/search")
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            val response = okhttp3.OkHttpClient().newCall(request).execute()
            val json = JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
            val results = json.getAsJsonArray("results") ?: return

            searchResults.clear()
            for (r in results) {
                val obj = r.asJsonObject
                val userId = obj.get("user_id")?.asString ?: continue
                if (userId == app.securePrefs.userId) continue // skip self
                searchResults.add(UserResult(
                    userId = userId,
                    displayName = obj.get("display_name")?.asString ?: userId.split(":")[0].removePrefix("@"),
                    avatarUrl = obj.get("avatar_url")?.asString
                ))
            }
            adapter.notifyDataSetChanged()
            tvEmpty.visibility = if (searchResults.isEmpty()) View.VISIBLE else View.GONE
            tvEmpty.text = "No users found"
        } catch (e: Exception) {
            tvEmpty.text = "Search error: ${e.message}"
            tvEmpty.visibility = View.VISIBLE
        }
        progress.visibility = View.GONE
    }

    private fun createDirectChat(user: UserResult) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            try {
                val body = """{"preset":"trusted_private_chat","invite":["${user.userId}"],"is_direct":true}"""
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/createRoom")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                val response = okhttp3.OkHttpClient().newCall(request).execute()
                val json = JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
                val roomId = json.get("room_id")?.asString

                if (roomId != null) {
                    val intent = Intent(this@CreateChatActivity, ChatActivity::class.java)
                    intent.putExtra("room_id", roomId)
                    intent.putExtra("room_name", user.displayName)
                    startActivity(intent)
                    finish()
                } else {
                    runOnUiThread {
                        Toast.makeText(this@CreateChatActivity, "Failed to create chat", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@CreateChatActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showCreateGroupDialog() {
        val input = EditText(this)
        input.hint = "Group name"
        input.setPadding(48, 32, 48, 32)

        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("Create Group")
            .setView(input)
            .setPositiveButton("Create") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) createGroup(name)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun createGroup(name: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            try {
                val body = """{"preset":"private_chat","name":"$name","initial_state":[]}"""
                val request = okhttp3.Request.Builder()
                    .url("$baseUrl/_matrix/client/v3/createRoom")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                val response = okhttp3.OkHttpClient().newCall(request).execute()
                val json = JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
                val roomId = json.get("room_id")?.asString

                if (roomId != null) {
                    val intent = Intent(this@CreateChatActivity, ChatActivity::class.java)
                    intent.putExtra("room_id", roomId)
                    intent.putExtra("room_name", name)
                    startActivity(intent)
                    finish()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@CreateChatActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

/** Simple adapter for user search results */
class UserSearchAdapter(
    private val users: List<CreateChatActivity.UserResult>,
    private val onClick: (CreateChatActivity.UserResult) -> Unit
) : RecyclerView.Adapter<UserSearchAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }

    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ViewHolder {
        val view = android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val user = users[position]
        holder.tvName.text = user.displayName
        holder.tvLastMessage.text = user.userId
        holder.tvAvatar.text = user.displayName.take(2).uppercase()
        holder.itemView.setOnClickListener { onClick(user) }
    }

    override fun getItemCount() = users.size
}
