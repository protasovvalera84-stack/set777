package io.meshlink.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.RecyclerView

/**
 * Swipe-to-reply helper for chat messages.
 * Swipe right on a message to reply.
 * Shows reply arrow indicator while swiping.
 */
class SwipeToReplyCallback(
    private val context: Context,
    private val onSwipe: (Int) -> Unit
) : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.RIGHT) {

    private val paint = Paint().apply {
        color = 0x33A855F7  // Purple with alpha
        isAntiAlias = true
    }
    private val arrowPaint = Paint().apply {
        color = 0xFFA855F7.toInt()
        isAntiAlias = true
        textSize = 48f
        textAlign = Paint.Align.CENTER
    }

    override fun onMove(rv: RecyclerView, vh: RecyclerView.ViewHolder, target: RecyclerView.ViewHolder) = false

    override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
        onSwipe(viewHolder.adapterPosition)
        // Reset the swipe (don't remove item)
        viewHolder.itemView.translationX = 0f
    }

    override fun getSwipeThreshold(viewHolder: RecyclerView.ViewHolder) = 0.3f

    override fun getSwipeEscapeVelocity(defaultValue: Float) = defaultValue * 3

    override fun onChildDraw(
        c: Canvas, recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder,
        dX: Float, dY: Float, actionState: Int, isCurrentlyActive: Boolean
    ) {
        val itemView = viewHolder.itemView
        val maxSwipe = itemView.width * 0.3f
        val clampedDx = dX.coerceIn(0f, maxSwipe)

        // Draw background
        if (clampedDx > 0) {
            val rect = RectF(itemView.left.toFloat(), itemView.top.toFloat(),
                itemView.left + clampedDx, itemView.bottom.toFloat())
            c.drawRoundRect(rect, 16f, 16f, paint)

            // Draw reply arrow
            if (clampedDx > 60) {
                val centerY = (itemView.top + itemView.bottom) / 2f
                c.drawText("↩", itemView.left + 40f, centerY + 16f, arrowPaint)
            }
        }

        // Move item
        itemView.translationX = clampedDx
    }
}

/**
 * Message bubble decorator — adds spacing and rounded backgrounds.
 */
class MessageItemDecoration(private val spacing: Int = 4) : RecyclerView.ItemDecoration() {
    override fun getItemOffsets(
        outRect: android.graphics.Rect, view: View,
        parent: RecyclerView, state: RecyclerView.State
    ) {
        outRect.bottom = spacing
    }
}

/**
 * Typing indicator view — shows "User is typing..." animation.
 */
class TypingIndicator(context: Context) : android.widget.TextView(context) {
    private var dotCount = 0
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var userName = ""

    init {
        textSize = 12f
        setTextColor(0xFF888888.toInt())
        setPadding(32, 8, 32, 8)
        visibility = View.GONE
    }

    fun show(user: String) {
        userName = user
        visibility = View.VISIBLE
        animateDots()
    }

    fun hide() {
        visibility = View.GONE
        handler.removeCallbacksAndMessages(null)
    }

    private fun animateDots() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                dotCount = (dotCount + 1) % 4
                text = "$userName is typing${".".repeat(dotCount)}"
                if (visibility == View.VISIBLE) handler.postDelayed(this, 400)
            }
        }, 400)
    }
}

/**
 * Unread messages divider — shows "X new messages" line.
 */
class UnreadDivider(context: Context) : android.widget.TextView(context) {
    init {
        textSize = 11f
        setTextColor(0xFFA855F7.toInt())
        gravity = android.view.Gravity.CENTER
        setPadding(0, 16, 0, 16)
        setBackgroundColor(0x11A855F7)
    }

    fun setCount(count: Int) {
        text = if (count == 1) "1 new message" else "$count new messages"
        visibility = if (count > 0) View.VISIBLE else View.GONE
    }
}
