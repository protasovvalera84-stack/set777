package io.meshlink.app.ui
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Media picker — select photos/videos from gallery or take with camera.
 * Uploads to Matrix server and sends as message.
 */
class MediaPicker(private val activity: AppCompatActivity) {

    private var roomId: String = ""
    private var onSent: (() -> Unit)? = null
    private var cameraPhotoFile: File? = null

    // Gallery picker
    val galleryLauncher = activity.registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) uploadAndSend(uri)
    }

    // Camera photo
    val cameraLauncher = activity.registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && cameraPhotoFile != null) {
            uploadAndSend(Uri.fromFile(cameraPhotoFile))
        }
    }

    // Camera video
    val videoLauncher = activity.registerForActivityResult(
        ActivityResultContracts.CaptureVideo()
    ) { success: Boolean ->
        if (success && cameraPhotoFile != null) {
            uploadAndSend(Uri.fromFile(cameraPhotoFile))
        }
    }

    // Permission request
    val permissionLauncher = activity.registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            // Permission granted — retry last action
        }
    }

    fun setRoom(roomId: String, onSent: () -> Unit) {
        this.roomId = roomId
        this.onSent = onSent
    }

    /** Open gallery to pick image or video */
    fun pickFromGallery() {
        galleryLauncher.launch("*/*")
    }

    /** Open camera to take photo */
    fun takePhoto() {
        if (!hasPermission(Manifest.permission.CAMERA)) {
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            return
        }
        val dir = File(activity.filesDir, ".meshlink_camera").also { it.mkdirs() }
        cameraPhotoFile = File(dir, "photo_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", cameraPhotoFile!!)
        cameraLauncher.launch(uri)
    }

    /** Open camera to record video */
    fun recordVideo() {
        if (!hasPermission(Manifest.permission.CAMERA)) {
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            return
        }
        val dir = File(activity.filesDir, ".meshlink_camera").also { it.mkdirs() }
        cameraPhotoFile = File(dir, "video_${System.currentTimeMillis()}.mp4")
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", cameraPhotoFile!!)
        videoLauncher.launch(uri)
    }

    private fun hasPermission(perm: String): Boolean {
        return ContextCompat.checkSelfPermission(activity, perm) == PackageManager.PERMISSION_GRANTED
    }

    private fun uploadAndSend(uri: Uri) {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        activity.lifecycleScope.launch {
            try {
                // Copy to temp file
                val tempFile = withContext(Dispatchers.IO) {
                    val input = activity.contentResolver.openInputStream(uri) ?: return@withContext null
                    val mimeType = activity.contentResolver.getType(uri) ?: "application/octet-stream"
                    val ext = when {
                        mimeType.contains("jpeg") || mimeType.contains("jpg") -> ".jpg"
                        mimeType.contains("png") -> ".png"
                        mimeType.contains("mp4") -> ".mp4"
                        mimeType.contains("webm") -> ".webm"
                        mimeType.contains("gif") -> ".gif"
                        else -> ".bin"
                    }
                    val file = File(activity.cacheDir, "upload_${System.currentTimeMillis()}$ext")
                    file.outputStream().use { out -> input.copyTo(out) }
                    file
                } ?: return@launch

                // Upload
                val mediaManager = MediaManager(activity, app.database, baseUrl)
                val mxcUrl = mediaManager.uploadMedia(tempFile, token)
                if (mxcUrl == null) {
                    Toast.makeText(activity, "Upload failed", Toast.LENGTH_SHORT).show()
                    return@launch
                }

                // Determine message type
                val mimeType = activity.contentResolver.getType(uri) ?: "application/octet-stream"
                val msgtype = when {
                    mimeType.startsWith("image/") -> "m.image"
                    mimeType.startsWith("video/") -> "m.video"
                    mimeType.startsWith("audio/") -> "m.audio"
                    else -> "m.file"
                }

                // Send message
                val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                val txn = "media${System.currentTimeMillis()}"
                val body = Gson().toJson(mapOf(
                    "msgtype" to msgtype,
                    "body" to tempFile.name,
                    "url" to mxcUrl,
                    "info" to mapOf(
                        "mimetype" to mimeType,
                        "size" to tempFile.length()
                    )
                ))
                withContext(Dispatchers.IO) {
                    val request = okhttp3.Request.Builder()
                        .url("$baseUrl/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txn")
                        .addHeader("Authorization", "Bearer $token")
                        .addHeader("Content-Type", "application/json")
                        .put(body.toRequestBody("application/json".toMediaType()))
                        .build()
                    okhttp3.OkHttpClient().newCall(request).execute()
                }

                tempFile.delete()
                onSent?.invoke()
                Toast.makeText(activity, "Sent", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(activity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
