package io.meshlink.app.util

import android.content.Context
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs

/**
 * Swipe gesture detector — for swipe-to-reply, swipe-to-delete.
 */
class SwipeGestureListener(
    context: Context,
    private val onSwipeLeft: (() -> Unit)? = null,
    private val onSwipeRight: (() -> Unit)? = null,
    private val onSwipeUp: (() -> Unit)? = null,
    private val onSwipeDown: (() -> Unit)? = null
) : View.OnTouchListener {

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        private val SWIPE_THRESHOLD = 100
        private val SWIPE_VELOCITY_THRESHOLD = 100

        override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
            if (e1 == null) return false
            val diffX = e2.x - e1.x
            val diffY = e2.y - e1.y

            if (abs(diffX) > abs(diffY)) {
                if (abs(diffX) > SWIPE_THRESHOLD && abs(velocityX) > SWIPE_VELOCITY_THRESHOLD) {
                    if (diffX > 0) onSwipeRight?.invoke() else onSwipeLeft?.invoke()
                    return true
                }
            } else {
                if (abs(diffY) > SWIPE_THRESHOLD && abs(velocityY) > SWIPE_VELOCITY_THRESHOLD) {
                    if (diffY > 0) onSwipeDown?.invoke() else onSwipeUp?.invoke()
                    return true
                }
            }
            return false
        }
    })

    override fun onTouch(v: View?, event: MotionEvent?): Boolean {
        return event?.let { gestureDetector.onTouchEvent(it) } ?: false
    }
}

/**
 * Debounce click listener — prevents double-tap issues.
 */
class DebouncedClickListener(
    private val interval: Long = 500,
    private val onClick: (View) -> Unit
) : View.OnClickListener {
    private var lastClickTime = 0L

    override fun onClick(v: View) {
        val now = System.currentTimeMillis()
        if (now - lastClickTime >= interval) {
            lastClickTime = now
            onClick(v)
        }
    }
}

/** Extension function for debounced clicks */
fun View.setDebouncedClickListener(interval: Long = 500, onClick: (View) -> Unit) {
    setOnClickListener(DebouncedClickListener(interval, onClick))
}
