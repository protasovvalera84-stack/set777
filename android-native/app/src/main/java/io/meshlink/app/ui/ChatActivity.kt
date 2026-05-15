package io.meshlink.app.ui

import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.data.MessageEntity
import kotlinx.coroutines.launch

/**
 * Chat screen — messages for a single room.
 * Messages cached in local SQLite.
 */
class ChatActivity : AppCompatActivity() {

    private lateinit var rvMessages: RecyclerView
    private lateinit var etMessage: EditText
    private lateinit var btnSend: ImageButton
    private lateinit var tvTitle: TextView
    private lateinit var adapter: MessageAdapter

    private var roomId: String = ""
    private var roomName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        roomId = intent.getStringExtra("room_id") ?: return finish()
        roomName = intent.getStringExtra("room_name") ?: "Chat"

        rvMessages = findViewById(R.id.rvMessages)
        etMessage = findViewById(R.id.etMessage)
        btnSend = findViewById(R.id.btnSend)
        tvTitle = findViewById(R.id.tvTitle)

        tvTitle.text = roomName

        val userId = MeshlinkApp.instance.securePrefs.userId ?: ""
        adapter = MessageAdapter(userId)

        val layoutManager = LinearLayoutManager(this)
        layoutManager.stackFromEnd = true
        rvMessages.layoutManager = layoutManager
        rvMessages.adapter = adapter

        btnSend.setOnClickListener { sendMessage() }
        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }

        loadMessages()
    }

    private fun loadMessages() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        lifecycleScope.launch {
            // Show cached messages first
            val cached = app.database.messageDao().getByRoom(roomId)
            if (cached.isNotEmpty()) {
                adapter.submitList(cached.reversed())
                rvMessages.scrollToPosition(adapter.itemCount - 1)
            }

            // Fetch from server
            try {
                val messages = app.matrixApi.getMessages(roomId, token)
                val entities = messages.map { msg ->
                    MessageEntity(
                        eventId = msg.eventId,
                        roomId = msg.roomId,
                        sender = msg.sender,
                        body = msg.body,
                        msgtype = msg.msgtype,
                        timestamp = msg.timestamp
                    )
                }
                app.database.messageDao().upsertAll(entities)
                adapter.submitList(entities.reversed())
                rvMessages.scrollToPosition(adapter.itemCount - 1)
            } catch (_: Exception) { /* use cached */ }
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
                val eventId = app.matrixApi.sendMessage(roomId, text, token)
                val msg = MessageEntity(
                    eventId = eventId,
                    roomId = roomId,
                    sender = app.securePrefs.userId ?: "",
                    body = text,
                    timestamp = System.currentTimeMillis()
                )
                app.database.messageDao().upsert(msg)
                loadMessages()
            } catch (_: Exception) { /* retry later */ }
        }
    }
}
