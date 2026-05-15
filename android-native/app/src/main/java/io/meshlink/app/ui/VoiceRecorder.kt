package io.meshlink.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.*
import java.io.File

/**
 * Voice message recorder — record, play, send audio messages.
 * Audio stored in app's private directory.
 */
class VoiceRecorder(private val context: android.content.Context) {

    private var recorder: MediaRecorder? = null
    private var player: MediaPlayer? = null
    private var currentFile: File? = null
    private var isRecording = false
    private var isPlaying = false
    private var startTime = 0L

    private val audioDir: File by lazy {
        File(context.filesDir, ".meshlink_voice").also { it.mkdirs() }
    }

    /** Start recording voice message */
    fun startRecording(): Boolean {
        if (isRecording) return false

        val file = File(audioDir, "voice_${System.currentTimeMillis()}.m4a")
        try {
            recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            currentFile = file
            isRecording = true
            startTime = System.currentTimeMillis()
            return true
        } catch (e: Exception) {
            file.delete()
            return false
        }
    }

    /** Stop recording and return the file */
    fun stopRecording(): File? {
        if (!isRecording) return null
        try {
            recorder?.stop()
            recorder?.release()
        } catch (_: Exception) {}
        recorder = null
        isRecording = false
        return currentFile
    }

    /** Get recording duration in seconds */
    fun getRecordingDuration(): Int {
        if (!isRecording) return 0
        return ((System.currentTimeMillis() - startTime) / 1000).toInt()
    }

    /** Play audio file */
    fun play(file: File, onComplete: () -> Unit = {}) {
        stop()
        try {
            player = MediaPlayer().apply {
                setDataSource(file.absolutePath)
                prepare()
                start()
                setOnCompletionListener {
                    isPlaying = false
                    onComplete()
                }
            }
            isPlaying = true
        } catch (_: Exception) {}
    }

    /** Stop playback */
    fun stop() {
        try {
            player?.stop()
            player?.release()
        } catch (_: Exception) {}
        player = null
        isPlaying = false
    }

    /** Clean up */
    fun release() {
        stopRecording()
        stop()
    }

    fun isRecording() = isRecording
    fun isPlaying() = isPlaying
}
