package io.meshlink.app.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Empty state view — shown when lists are empty.
 * Displays icon, title, subtitle, and optional action button.
 */
class EmptyStateView(context: Context, attrs: AttributeSet? = null) : LinearLayout(context, attrs) {

    private val tvIcon = TextView(context).apply {
        textSize = 48f; gravity = android.view.Gravity.CENTER
        setTextColor(0x33FFFFFF)
    }
    private val tvTitle = TextView(context).apply {
        textSize = 16f; gravity = android.view.Gravity.CENTER
        setTextColor(0xFFE0E0E0.toInt())
        typeface = Typeface.DEFAULT_BOLD
    }
    private val tvSubtitle = TextView(context).apply {
        textSize = 13f; gravity = android.view.Gravity.CENTER
        setTextColor(0xFF666666.toInt())
    }

    init {
        orientation = VERTICAL
        gravity = android.view.Gravity.CENTER
        setPadding(48, 48, 48, 48)
        addView(tvIcon, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        addView(tvTitle, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { topMargin = 16 })
        addView(tvSubtitle, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { topMargin = 8 })
    }

    fun setState(icon: String, title: String, subtitle: String) {
        tvIcon.text = icon
        tvTitle.text = title
        tvSubtitle.text = subtitle
    }
}

/**
 * Loading overlay — full screen loading indicator.
 */
class LoadingOverlay(context: Context, attrs: AttributeSet? = null) : android.widget.FrameLayout(context, attrs) {

    init {
        setBackgroundColor(0xCC0A0A12.toInt())
        val progress = android.widget.ProgressBar(context).apply {
            indeterminateTintList = android.content.res.ColorStateList.valueOf(0xFFA855F7.toInt())
        }
        addView(progress, LayoutParams(64, 64).apply { gravity = android.view.Gravity.CENTER })
        visibility = View.GONE
    }

    fun show() { visibility = View.VISIBLE }
    fun hide() { visibility = View.GONE }
}

/**
 * Connection banner — shows "No internet" / "Connecting..." at top.
 */
class ConnectionBanner(context: Context, attrs: AttributeSet? = null) : TextView(context, attrs) {

    init {
        textSize = 12f
        gravity = android.view.Gravity.CENTER
        setPadding(0, 8, 0, 8)
        visibility = View.GONE
    }

    fun showOffline() {
        text = "No internet connection"
        setBackgroundColor(0xFFEF4444.toInt())
        setTextColor(0xFFFFFFFF.toInt())
        visibility = View.VISIBLE
    }

    fun showConnecting() {
        text = "Connecting..."
        setBackgroundColor(0xFFF59E0B.toInt())
        setTextColor(0xFF000000.toInt())
        visibility = View.VISIBLE
    }

    fun showOnline() {
        text = "Connected"
        setBackgroundColor(0xFF22C55E.toInt())
        setTextColor(0xFFFFFFFF.toInt())
        visibility = View.VISIBLE
        postDelayed({ visibility = View.GONE }, 2000)
    }

    fun hide() { visibility = View.GONE }
}

/**
 * Gradient text view — text with gradient color.
 */
class GradientTextView(context: Context, attrs: AttributeSet? = null) : androidx.appcompat.widget.AppCompatTextView(context, attrs) {

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (width > 0) {
            paint.shader = LinearGradient(
                0f, 0f, width.toFloat(), 0f,
                intArrayOf(0xFFA855F7.toInt(), 0xFF6366F1.toInt()),
                null, Shader.TileMode.CLAMP
            )
        }
    }
}

/**
 * Circular progress view — for upload/download progress.
 */
class CircularProgress(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x33FFFFFF; style = Paint.Style.STROKE; strokeWidth = 8f
    }
    private val fgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFA855F7.toInt(); style = Paint.Style.STROKE; strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt(); textSize = 24f; textAlign = Paint.Align.CENTER
    }
    private val rect = RectF()
    var progress = 0f
        set(value) { field = value.coerceIn(0f, 100f); invalidate() }

    override fun onDraw(canvas: Canvas) {
        val pad = 12f
        rect.set(pad, pad, width - pad, height - pad)
        canvas.drawArc(rect, 0f, 360f, false, bgPaint)
        canvas.drawArc(rect, -90f, progress * 3.6f, false, fgPaint)
        canvas.drawText("${progress.toInt()}%", width / 2f, height / 2f + 8f, textPaint)
    }
}
