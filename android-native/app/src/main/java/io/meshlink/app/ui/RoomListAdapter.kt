package io.meshlink.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import io.meshlink.app.R
import io.meshlink.app.data.RoomEntity

/**
 * RecyclerView adapter for room list.
 */
class RoomListAdapter(
    private val onClick: (RoomEntity) -> Unit
) : ListAdapter<RoomEntity, RoomListAdapter.ViewHolder>(DIFF) {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar: TextView = view.findViewById(R.id.tvAvatar)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_room, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val room = getItem(position)
        holder.tvName.text = room.name
        holder.tvLastMessage.text = room.lastMessage ?: room.topic ?: ""
        holder.tvAvatar.text = room.name.take(2).uppercase()
        holder.itemView.setOnClickListener { onClick(room) }
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<RoomEntity>() {
            override fun areItemsTheSame(a: RoomEntity, b: RoomEntity) = a.roomId == b.roomId
            override fun areContentsTheSame(a: RoomEntity, b: RoomEntity) = a == b
        }
    }
}
