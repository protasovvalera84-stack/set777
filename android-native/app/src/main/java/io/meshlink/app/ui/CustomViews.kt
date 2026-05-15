package io.meshlink.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import io.meshlink.app.data.MessageEntity

/**
 * Chat bubble view — Telegram-style message bubbles.
 * Own messages: right-aligned, purple background.
 * Other messages: left-aligned, dark background.
 */
class ChatBubbleView(context: Context, attrs: AttributeSet? = null) : FrameLayout(context, attrs) {

    private val bubblePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()
    private val radius = 24f
    private var isOutgoing = false

    private val tvSender = TextView(context).apply {
        textSize = 11f; setTypeface(null, Typeface.BOLD); setPadding(4, 0, 4, 2)
    }
    private val tvBody = TextView(context).apply {
        textSize = 15f; setPadding(4, 2, 4, 2); setTextColor(0xFFE0E0E0.toInt())
    }
    private val tvTime = TextView(context).apply {
        textSize = 10f; setTextColor(0xFF666666.toInt()); setPadding(4, 2, 4, 0)
    }
    private val tvReactions = TextView(context).apply {
        textSize = 12f; setPadding(4, 4, 4, 0); visibility = View.GONE
    }

    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(28, 16, 28, 12)
        addView(tvSender)
        addView(tvBody)
        addView(tvReactions)
        addView(tvTime)
    }

    init {
        addView(content, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            setMargins(8, 4, 8, 4)
        })
        setWillNotDraw(false)
    }

    fun bind(message: MessageEntity, myUserId: String, reactions: String? = null) {
        isOutgoing = message.sender == myUserId

        tvSender.text = if (isOutgoing) "" else message.sender.split(":")[0].removePrefix("@")
        tvSender.setTextColor(if (isOutgoing) 0xFF22C55E.toInt() else 0xFFA855F7.toInt())
        tvSender.visibility = if (isOutgoing) View.GONE else View.VISIBLE

        tvBody.text = when (message.msgtype) {
            "m.audio" -> "\uD83C\uDFA4 Voice message"
            "m.image" -> "\uD83D\uDCF7 Photo"
            "m.video" -> "\uD83C\uDFAC Video"
            "m.file" -> "\uD83D\uDCCE File"
            else -> message.body
        }

        val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(message.timestamp))
        tvTime.text = time
        tvTime.gravity = if (isOutgoing) Gravity.END else Gravity.START

        if (reactions != null) {
            tvReactions.text = reactions
            tvReactions.visibility = View.VISIBLE
        } else {
            tvReactions.visibility = View.GONE
        }

        // Align bubble
        (content.layoutParams as LayoutParams).gravity = if (isOutgoing) Gravity.END else Gravity.START
        content.layoutParams = content.layoutParams

        bubblePaint.color = if (isOutgoing) 0xFF1E1B4B.toInt() else 0xFF1A1A2E.toInt()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val child = content
        rect.set(
            child.left.toFloat(), child.top.toFloat(),
            child.right.toFloat(), child.bottom.toFloat()
        )
        canvas.drawRoundRect(rect, radius, radius, bubblePaint)
        super.onDraw(canvas)
    }
}

/**
 * Avatar view — circular with initials.
 */
class AvatarView(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2D1B69.toInt() }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt(); textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD
    }
    private var initials = ""

    fun setUser(name: String, color: Int = 0xFF2D1B69.toInt()) {
        initials = name.take(2).uppercase()
        bgPaint.color = color
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = minOf(cx, cy)
        canvas.drawCircle(cx, cy, r, bgPaint)
        textPaint.textSize = r * 0.8f
        canvas.drawText(initials, cx, cy + textPaint.textSize / 3, textPaint)
    }
}

/**
 * Online status indicator — green dot.
 */
class OnlineIndicator(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF22C55E.toInt() }
    var isOnline = false
        set(value) { field = value; invalidate() }

    override fun onDraw(canvas: Canvas) {
        if (isOnline) {
            canvas.drawCircle(width / 2f, height / 2f, minOf(width, height) / 2f, paint)
        }
    }
}

/**
 * Badge count view — unread message counter.
 */
class BadgeView(context: Context, attrs: AttributeSet? = null) : TextView(context, attrs) {
    init {
        setBackgroundResource(0)
        setTextColor(0xFFFFFFFF.toInt())
        textSize = 10f
        gravity = Gravity.CENTER
        setPadding(12, 4, 12, 4)
        visibility = View.GONE
    }

    fun setCount(count: Int) {
        text = if (count > 99) "99+" else count.toString()
        visibility = if (count > 0) View.VISIBLE else View.GONE
    }

    override fun onDraw(canvas: Canvas) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFA855F7.toInt() }
        canvas.drawRoundRect(0f, 0f, width.toFloat(), height.toFloat(), height / 2f, height / 2f, paint)
        super.onDraw(canvas)
    }
}
