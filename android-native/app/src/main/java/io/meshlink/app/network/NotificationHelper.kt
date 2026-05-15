package io.meshlink.app.network

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import io.meshlink.app.R
import io.meshlink.app.ui.ChatActivity

/**
 * Notification helper — shows message notifications.
 * Uses local polling (SyncService) instead of FCM.
 * No Google Play Services dependency.
 */
class NotificationHelper(private val context: Context) {

    companion object {
        const val CHANNEL_ID = "meshlink_messages"
        const val CHANNEL_NAME = "Messages"
        private var notifId = 1000
    }

    init {
        createChannel()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New message notifications"
                enableVibration(true)
                enableLights(true)
                lightColor = 0xFFA855F7.toInt()
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    fun showMessageNotification(
        senderName: String,
        messageBody: String,
        roomId: String,
        roomName: String
    ) {
        val intent = Intent(context, ChatActivity::class.java).apply {
            putExtra("room_id", roomId)
            putExtra("room_name", roomName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(senderName)
            .setContentText(messageBody)
            .setSubText(roomName)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(0xFFA855F7.toInt())
            .build()

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(notifId++, notification)
    }

    fun cancelAll() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancelAll()
    }
}
