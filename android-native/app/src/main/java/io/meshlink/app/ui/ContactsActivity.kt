package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

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
 * Contacts/Friends — send requests, accept/reject, view friends list.
 * Friends stored in Matrix account_data (org.meshlink.friends).
 */
class ContactsActivity : AppCompatActivity() {

    data class Friend(val userId: String, val name: String, val status: String) // "friend", "pending_sent", "pending_received"

    private lateinit var rvContacts: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var etSearch: EditText
    private val friends = mutableListOf<Friend>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        rvContacts = findViewById(R.id.rvContacts)
        tvEmpty = findViewById(R.id.tvEmpty)
        etSearch = findViewById(R.id.etSearch)
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        rvContacts.layoutManager = LinearLayoutManager(this)
        loadFriends()
    }

    private fun loadFriends() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val userId = app.securePrefs.userId ?: return

        lifecycleScope.launch {
            try {
                val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
                val resp = withContext(Dispatchers.IO) {
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/user/$encoded/account_data/org.meshlink.friends")
                        .addHeader("Authorization", "Bearer $token").build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                }
                friends.clear()
                if (resp.isSuccessful) {
                    val json = JsonParser.parseString(resp.body?.string() ?: "{}").asJsonObject
                    json.getAsJsonArray("friends")?.forEach { f ->
                        val obj = f.asJsonObject
                        friends.add(Friend(
                            userId = obj.get("userId")?.asString ?: "",
                            name = obj.get("name")?.asString ?: obj.get("userId")?.asString?.split(":")?.get(0)?.removePrefix("@") ?: "",
                            status = obj.get("status")?.asString ?: "friend"
                        ))
                    }
                }
                tvEmpty.visibility = if (friends.isEmpty()) View.VISIBLE else View.GONE
                tvEmpty.text = "No friends yet\nSearch users to add friends"
                rvContacts.adapter = FriendsAdapter(friends,
                    onAccept = { friend -> acceptFriend(friend) },
                    onReject = { friend -> removeFriend(friend) },
                    onChat = { friend -> openChat(friend) }
                )
            } catch (e: Exception) {
                tvEmpty.visibility = View.VISIBLE
                tvEmpty.text = "Error: ${e.message}"
            }
        }
    }

    private fun saveFriends() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return
        val userId = app.securePrefs.userId ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encoded = java.net.URLEncoder.encode(userId, "UTF-8")
                    val data = Gson().toJson(mapOf(
                        "friends" to friends.map { mapOf("userId" to it.userId, "name" to it.name, "status" to it.status) }
                    ))
                    val req = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/user/$encoded/account_data/org.meshlink.friends")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(data.toRequestBody("application/json".toMediaType()))
                        .build()
                    okhttp3.OkHttpClient().newCall(req).execute()
                } catch (_: Exception) {}
            }
        }
    }

    private fun acceptFriend(friend: Friend) {
        val idx = friends.indexOfFirst { it.userId == friend.userId }
        if (idx >= 0) {
            friends[idx] = friend.copy(status = "friend")
            saveFriends()
            loadFriends()
        }
    }

    private fun removeFriend(friend: Friend) {
        friends.removeAll { it.userId == friend.userId }
        saveFriends()
        loadFriends()
    }

    private fun openChat(friend: Friend) {
        val intent = android.content.Intent(this, CreateChatActivity::class.java)
        startActivity(intent)
    }
}

class FriendsAdapter(
    private val friends: List<ContactsActivity.Friend>,
    private val onAccept: (ContactsActivity.Friend) -> Unit,
    private val onReject: (ContactsActivity.Friend) -> Unit,
    private val onChat: (ContactsActivity.Friend) -> Unit
) : RecyclerView.Adapter<FriendsAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }

    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): VH {
        return VH(android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false))
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val friend = friends[position]
        holder.tvName.text = friend.name
        holder.tvAvatar.text = friend.name.take(2).uppercase()
        holder.tvLastMessage.text = when (friend.status) {
            "pending_received" -> "Wants to be friends — tap to accept"
            "pending_sent" -> "Request sent"
            else -> "Friend"
        }
        holder.tvLastMessage.setTextColor(
            if (friend.status == "pending_received") 0xFFA855F7.toInt() else 0xFF666666.toInt()
        )
        holder.itemView.setOnClickListener {
            when (friend.status) {
                "pending_received" -> onAccept(friend)
                "friend" -> onChat(friend)
                else -> {}
            }
        }
        holder.itemView.setOnLongClickListener {
            onReject(friend)
            true
        }
    }

    override fun getItemCount() = friends.size
}
