package io.meshlink.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import io.meshlink.app.R
import io.meshlink.app.data.MessageEntity

class MessageAdapter(
    private val myUserId: String
) : ListAdapter<MessageEntity, MessageAdapter.ViewHolder>(DIFF) {

    var onLongClick: ((MessageEntity) -> Unit)? = null

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvSender: TextView = view.findViewById(R.id.tvSender)
        val tvBody: TextView = view.findViewById(R.id.tvBody)
        val tvTime: TextView = view.findViewById(R.id.tvTime)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val msg = getItem(position)
        val isMe = msg.sender == myUserId
        holder.tvSender.text = if (isMe) "You" else msg.sender.split(":")[0].removePrefix("@")
        holder.tvSender.setTextColor(if (isMe) 0xFF22C55E.toInt() else 0xFFA855F7.toInt())

        // Format body based on type
        holder.tvBody.text = when (msg.msgtype) {
            "m.audio" -> "🎤 Voice message"
            "m.image" -> "📷 Photo"
            "m.video" -> "🎬 Video"
            "m.file" -> "📎 File"
            else -> msg.body
        }

        val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(msg.timestamp))
        holder.tvTime.text = time

        // Long press for actions
        holder.itemView.setOnLongClickListener {
            onLongClick?.invoke(msg)
            true
        }
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<MessageEntity>() {
            override fun areItemsTheSame(a: MessageEntity, b: MessageEntity) = a.eventId == b.eventId
            override fun areContentsTheSame(a: MessageEntity, b: MessageEntity) = a == b
        }
    }
}
