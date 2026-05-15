package io.meshlink.app.util

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.OvershootInterpolator
import androidx.recyclerview.widget.DefaultItemAnimator
import androidx.recyclerview.widget.RecyclerView

/**
 * UI animations — smooth transitions for chat, lists, dialogs.
 */
object Animations {

    /** Fade in a view */
    fun fadeIn(view: View, duration: Long = 200) {
        view.alpha = 0f
        view.visibility = View.VISIBLE
        view.animate().alpha(1f).setDuration(duration).start()
    }

    /** Fade out a view */
    fun fadeOut(view: View, duration: Long = 200) {
        view.animate().alpha(0f).setDuration(duration).withEndAction {
            view.visibility = View.GONE
        }.start()
    }

    /** Slide in from bottom */
    fun slideInBottom(view: View, duration: Long = 300) {
        view.translationY = view.height.toFloat()
        view.visibility = View.VISIBLE
        view.animate()
            .translationY(0f)
            .setDuration(duration)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .start()
    }

    /** Slide out to bottom */
    fun slideOutBottom(view: View, duration: Long = 300) {
        view.animate()
            .translationY(view.height.toFloat())
            .setDuration(duration)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .withEndAction { view.visibility = View.GONE }
            .start()
    }

    /** Scale bounce (for like button, reactions) */
    fun scaleBounce(view: View, scale: Float = 1.3f, duration: Long = 200) {
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 1f, scale, 1f)
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 1f, scale, 1f)
        AnimatorSet().apply {
            playTogether(scaleX, scaleY)
            this.duration = duration
            interpolator = OvershootInterpolator()
            start()
        }
    }

    /** Shake animation (for errors) */
    fun shake(view: View, duration: Long = 400) {
        ObjectAnimator.ofFloat(view, "translationX", 0f, -10f, 10f, -10f, 10f, -5f, 5f, 0f)
            .apply { this.duration = duration; start() }
    }

    /** Pulse animation (for recording indicator) */
    fun pulse(view: View): ObjectAnimator {
        return ObjectAnimator.ofFloat(view, "alpha", 1f, 0.3f, 1f).apply {
            duration = 1000
            repeatCount = ObjectAnimator.INFINITE
            start()
        }
    }

    /** Item appear animation for RecyclerView */
    fun animateItem(view: View, position: Int) {
        view.alpha = 0f
        view.translationY = 50f
        view.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(200)
            .setStartDelay((position * 30).toLong())
            .start()
    }
}

/**
 * Custom RecyclerView item animator with slide-in effect.
 */
class SlideInAnimator : DefaultItemAnimator() {
    override fun animateAdd(holder: RecyclerView.ViewHolder): Boolean {
        holder.itemView.alpha = 0f
        holder.itemView.translationY = 30f
        holder.itemView.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(200)
            .start()
        return super.animateAdd(holder)
    }
}
