package io.meshlink.app.ui

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
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
 * Group settings — members, roles, name, avatar, invite, kick.
 */
class GroupSettingsActivity : AppCompatActivity() {

    data class Member(val userId: String, val name: String, val powerLevel: Int)

    private lateinit var tvGroupName: TextView
    private lateinit var etGroupName: EditText
    private lateinit var rvMembers: RecyclerView
    private lateinit var tvMemberCount: TextView
    private lateinit var btnInvite: Button
    private lateinit var btnLeave: Button
    private lateinit var btnSaveName: Button
    private val members = mutableListOf<Member>()
    private var roomId = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_group_settings)

        roomId = intent.getStringExtra("room_id") ?: return finish()

        tvGroupName = findViewById(R.id.tvGroupName)
        etGroupName = findViewById(R.id.etGroupName)
        rvMembers = findViewById(R.id.rvMembers)
        tvMemberCount = findViewById(R.id.tvMemberCount)
        btnInvite = findViewById(R.id.btnInvite)
        btnLeave = findViewById(R.id.btnLeave)
        btnSaveName = findViewById(R.id.btnSaveName)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        rvMembers.layoutManager = LinearLayoutManager(this)
        btnInvite.setOnClickListener { showInviteDialog() }
        btnLeave.setOnClickListener { leaveGroup() }
        btnSaveName.setOnClickListener { saveGroupName() }

        loadGroupInfo()
    }

    private fun loadGroupInfo() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            try {
                val info = app.matrixApi.getRoomState(roomId, token)
                tvGroupName.text = info.name
                etGroupName.setText(info.name)

                // Load members
                val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                val resp = withContext(Dispatchers.IO) {
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/joined_members")
                        .addHeader("Authorization", "Bearer $token").build()).execute()
                }
                members.clear()
                if (resp.isSuccessful) {
                    val json = JsonParser.parseString(resp.body()?.string() ?: "{}").asJsonObject
                    json.getAsJsonObject("joined")?.entrySet()?.forEach { (userId, data) ->
                        val name = data.asJsonObject.get("display_name")?.asString
                            ?: userId.split(":")[0].removePrefix("@")
                        members.add(Member(userId, name, 0))
                    }
                }
                tvMemberCount.text = "${members.size} members"
                rvMembers.adapter = MemberAdapter(members, app.securePrefs.userId ?: "") { member ->
                    showMemberActions(member)
                }
            } catch (e: Exception) {
                Toast.makeText(this@GroupSettingsActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showMemberActions(member: Member) {
        val app = MeshlinkApp.instance
        if (member.userId == app.securePrefs.userId) return
        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle(member.name)
            .setItems(arrayOf("Kick from group", "Cancel")) { _, which ->
                if (which == 0) kickMember(member)
            }.show()
    }

    private fun kickMember(member: Member) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val body = Gson().toJson(mapOf("user_id" to member.userId, "reason" to "Removed by admin"))
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/kick")
                        .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                        .post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body)).build()).execute()
                } catch (_: Exception) {}
            }
            loadGroupInfo()
        }
    }

    private fun showInviteDialog() {
        val input = EditText(this).apply { hint = "@user:server"; setPadding(48, 32, 48, 32) }
        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("Invite User")
            .setView(input)
            .setPositiveButton("Invite") { _, _ ->
                val userId = input.text.toString().trim()
                if (userId.startsWith("@")) inviteUser(userId)
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun inviteUser(userId: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val body = Gson().toJson(mapOf("user_id" to userId))
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/invite")
                        .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                        .post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body)).build()).execute()
                } catch (_: Exception) {}
            }
            Toast.makeText(this@GroupSettingsActivity, "Invited $userId", Toast.LENGTH_SHORT).show()
            loadGroupInfo()
        }
    }

    private fun saveGroupName() {
        val newName = etGroupName.text.toString().trim()
        if (newName.isEmpty()) return
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val body = Gson().toJson(mapOf("name" to newName))
                    okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/state/m.room.name/")
                        .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                        .put(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body)).build()).execute()
                } catch (_: Exception) {}
            }
            tvGroupName.text = newName
            Toast.makeText(this@GroupSettingsActivity, "Name updated", Toast.LENGTH_SHORT).show()
        }
    }

    private fun leaveGroup() {
        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("Leave Group")
            .setMessage("Are you sure?")
            .setPositiveButton("Leave") { _, _ ->
                val app = MeshlinkApp.instance
                val token = app.securePrefs.accessToken ?: return@setPositiveButton
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        try {
                            val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                            okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                                .url("${app.securePrefs.serverUrl}/_matrix/client/v3/rooms/$encoded/leave")
                                .addHeader("Authorization", "Bearer $token").addHeader("Content-Type", "application/json")
                                .post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), "{}")).build()).execute()
                            app.database.roomDao().delete(roomId)
                        } catch (_: Exception) {}
                    }
                    finish()
                }
            }
            .setNegativeButton("Cancel", null).show()
    }
}

class MemberAdapter(
    private val members: List<GroupSettingsActivity.Member>,
    private val myUserId: String,
    private val onAction: (GroupSettingsActivity.Member) -> Unit
) : RecyclerView.Adapter<MemberAdapter.VH>() {
    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }
    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int) =
        VH(android.view.LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false))
    override fun onBindViewHolder(holder: VH, position: Int) {
        val m = members[position]
        holder.tvName.text = m.name
        holder.tvAvatar.text = m.name.take(2).uppercase()
        holder.tvLastMessage.text = if (m.userId == myUserId) "You" else m.userId
        holder.itemView.setOnLongClickListener { onAction(m); true }
    }
    override fun getItemCount() = members.size
}
