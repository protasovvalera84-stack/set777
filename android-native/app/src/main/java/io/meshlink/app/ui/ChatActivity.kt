package io.meshlink.app.ui

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.data.MessageEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Chat screen — messages with reactions, replies, forwarding.
 * Long-press message for actions menu.
 */
class ChatActivity : AppCompatActivity() {

    private lateinit var rvMessages: RecyclerView
    private lateinit var etMessage: EditText
    private lateinit var btnSend: ImageButton
    private lateinit var btnAttach: ImageButton
    private lateinit var btnVoice: ImageButton
    private lateinit var tvTitle: TextView
    private lateinit var tvReplyPreview: TextView
    private lateinit var btnCancelReply: View
    private lateinit var replyBar: View
    private lateinit var adapter: MessageAdapter

    private var roomId: String = ""
    private var roomName: String = ""
    private var replyToEvent: MessageEntity? = null
    private var voiceRecorder: VoiceRecorder? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        roomId = intent.getStringExtra("room_id") ?: return finish()
        roomName = intent.getStringExtra("room_name") ?: "Chat"

        rvMessages = findViewById(R.id.rvMessages)
        etMessage = findViewById(R.id.etMessage)
        btnSend = findViewById(R.id.btnSend)
        tvTitle = findViewById(R.id.tvTitle)

        // Optional UI elements (may not exist in simple layout)
        btnAttach = findViewById(R.id.btnAttach) ?: ImageButton(this)
        btnVoice = findViewById(R.id.btnVoice) ?: ImageButton(this)
        replyBar = findViewById(R.id.replyBar) ?: View(this)
        tvReplyPreview = findViewById(R.id.tvReplyPreview) ?: TextView(this)
        btnCancelReply = findViewById(R.id.btnCancelReply) ?: View(this)

        tvTitle.text = roomName
        replyBar.visibility = View.GONE

        val userId = MeshlinkApp.instance.securePrefs.userId ?: ""
        adapter = MessageAdapter(userId)

        // Long press for message actions
        adapter.onLongClick = { message -> showMessageActions(message) }

        val layoutManager = LinearLayoutManager(this)
        layoutManager.stackFromEnd = true
        rvMessages.layoutManager = layoutManager
        rvMessages.adapter = adapter

        btnSend.setOnClickListener { sendMessage() }
        btnCancelReply.setOnClickListener { cancelReply() }
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        // Voice recording
        voiceRecorder = VoiceRecorder(this)
        btnVoice.setOnClickListener { toggleVoiceRecording() }

        // Call buttons
        findViewById<View>(R.id.btnVoiceCall)?.setOnClickListener { startCall("voice") }
        findViewById<View>(R.id.btnVideoCall)?.setOnClickListener { startCall("video") }

        loadMessages()
    }

    private fun showMessageActions(message: MessageEntity) {
        val actions = arrayOf("Reply", "React", "Forward", "Copy", "Delete")
        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("Message")
            .setItems(actions) { _, which ->
                when (which) {
                    0 -> setReply(message)
                    1 -> showReactionPicker(message)
                    2 -> forwardMessage(message)
                    3 -> copyMessage(message)
                    4 -> deleteMessage(message)
                }
            }
            .show()
    }

    private fun setReply(message: MessageEntity) {
        replyToEvent = message
        val sender = message.sender.split(":")[0].removePrefix("@")
        tvReplyPreview.text = "$sender: ${message.body.take(50)}"
        replyBar.visibility = View.VISIBLE
        etMessage.requestFocus()
    }

    private fun cancelReply() {
        replyToEvent = null
        replyBar.visibility = View.GONE
    }

    private fun showReactionPicker(message: MessageEntity) {
        val emojis = arrayOf("👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "✅")
        AlertDialog.Builder(this, R.style.DialogTheme)
            .setTitle("React")
            .setItems(emojis) { _, which ->
                sendReaction(message.eventId, emojis[which])
            }
            .show()
    }

    private fun sendReaction(eventId: String, emoji: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val txn = "react${System.currentTimeMillis()}"
                    val body = Gson().toJson(mapOf(
                        "m.relates_to" to mapOf(
                            "rel_type" to "m.annotation",
                            "event_id" to eventId,
                            "key" to emoji
                        )
                    ))
                    val request = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/send/m.reaction/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body))
                        .build()
                    okhttp3.OkHttpClient().newCall(request).execute()
                } catch (_: Exception) {}
            }
            Toast.makeText(this@ChatActivity, "Reacted $emoji", Toast.LENGTH_SHORT).show()
        }
    }

    private fun forwardMessage(message: MessageEntity) {
        // Open room picker to forward
        val app = MeshlinkApp.instance
        lifecycleScope.launch {
            val rooms = app.database.roomDao().getAll()
            val names = rooms.map { it.name }.toTypedArray()
            runOnUiThread {
                AlertDialog.Builder(this@ChatActivity, R.style.DialogTheme)
                    .setTitle("Forward to")
                    .setItems(names) { _, which ->
                        val targetRoom = rooms[which]
                        sendForward(targetRoom.roomId, message.body)
                    }
                    .show()
            }
        }
    }

    private fun sendForward(targetRoomId: String, text: String) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        lifecycleScope.launch {
            try {
                app.matrixApi.sendMessage(targetRoomId, "↪ $text", token)
                Toast.makeText(this@ChatActivity, "Forwarded", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {}
        }
    }

    private fun copyMessage(message: MessageEntity) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", message.body))
        Toast.makeText(this, "Copied", Toast.LENGTH_SHORT).show()
    }

    private fun deleteMessage(message: MessageEntity) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val encodedRoom = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val encodedEvent = java.net.URLEncoder.encode(message.eventId, "UTF-8")
                    val txn = "redact${System.currentTimeMillis()}"
                    val request = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encodedRoom/redact/$encodedEvent/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), """{"reason":"deleted"}"""))
                        .build()
                    okhttp3.OkHttpClient().newCall(request).execute()
                    app.database.messageDao().upsert(message.copy(body = "[deleted]"))
                } catch (_: Exception) {}
            }
            loadMessages()
        }
    }

    private fun toggleVoiceRecording() {
        val vr = voiceRecorder ?: return
        if (vr.isRecording()) {
            val file = vr.stopRecording()
            if (file != null) {
                btnVoice.alpha = 1.0f
                uploadAndSendVoice(file)
            }
        } else {
            if (vr.startRecording()) {
                btnVoice.alpha = 0.4f
                Toast.makeText(this, "Recording... tap again to stop", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun uploadAndSendVoice(file: java.io.File) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val mediaManager = io.meshlink.app.network.MediaManager(this, app.database, app.securePrefs.serverUrl ?: "")

        lifecycleScope.launch {
            val mxcUrl = mediaManager.uploadMedia(file, token)
            if (mxcUrl != null) {
                val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                val txn = "voice${System.currentTimeMillis()}"
                val body = Gson().toJson(mapOf(
                    "msgtype" to "m.audio",
                    "body" to "Voice message",
                    "url" to mxcUrl,
                    "info" to mapOf("mimetype" to "audio/m4a", "size" to file.length())
                ))
                withContext(Dispatchers.IO) {
                    val request = okhttp3.Request.Builder()
                        .url("${app.securePrefs.serverUrl}/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body))
                        .build()
                    okhttp3.OkHttpClient().newCall(request).execute()
                }
                loadMessages()
            }
        }
    }

    private fun startCall(type: String) {
        val intent = Intent(this, CallActivity::class.java)
        intent.putExtra(CallActivity.EXTRA_ROOM_ID, roomId)
        intent.putExtra(CallActivity.EXTRA_CALL_TYPE, type)
        intent.putExtra("caller_name", roomName)
        startActivity(intent)
    }

    private fun loadMessages() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        lifecycleScope.launch {
            val cached = app.database.messageDao().getByRoom(roomId)
            if (cached.isNotEmpty()) {
                adapter.submitList(cached.reversed())
                rvMessages.scrollToPosition(adapter.itemCount - 1)
            }

            try {
                val messages = app.matrixApi.getMessages(roomId, token)
                val entities = messages.map { msg ->
                    MessageEntity(
                        eventId = msg.eventId, roomId = msg.roomId,
                        sender = msg.sender, body = msg.body,
                        msgtype = msg.msgtype, timestamp = msg.timestamp
                    )
                }
                app.database.messageDao().upsertAll(entities)
                adapter.submitList(entities.reversed())
                rvMessages.scrollToPosition(adapter.itemCount - 1)
            } catch (_: Exception) {}
        }
    }

    private fun sendMessage() {
        val text = etMessage.text.toString().trim()
        if (text.isEmpty()) return

        etMessage.setText("")
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        lifecycleScope.launch {
            try {
                if (replyToEvent != null) {
                    // Send reply
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val txn = "reply${System.currentTimeMillis()}"
                    val body = Gson().toJson(mapOf(
                        "msgtype" to "m.text",
                        "body" to text,
                        "m.relates_to" to mapOf(
                            "m.in_reply_to" to mapOf("event_id" to replyToEvent!!.eventId)
                        )
                    ))
                    withContext(Dispatchers.IO) {
                        val request = okhttp3.Request.Builder()
                            .url("${app.securePrefs.serverUrl}/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txn")
                            .addHeader("Authorization", "Bearer $token")
                            .addHeader("Content-Type", "application/json")
                            .put(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body))
                            .build()
                        okhttp3.OkHttpClient().newCall(request).execute()
                    }
                    cancelReply()
                } else {
                    app.matrixApi.sendMessage(roomId, text, token)
                }
                loadMessages()
            } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        voiceRecorder?.release()
        super.onDestroy()
    }
}
