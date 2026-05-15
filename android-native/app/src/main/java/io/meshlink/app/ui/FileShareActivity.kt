package io.meshlink.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import io.meshlink.app.network.MediaManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * File sharing — send any file type to a chat room.
 * Supports: documents, archives, APKs, any file.
 */
class FileShareActivity : AppCompatActivity() {

    private var roomId = ""
    private var roomName = ""
    private lateinit var tvFileName: TextView
    private lateinit var tvFileSize: TextView
    private lateinit var btnSend: Button
    private lateinit var progress: ProgressBar
    private var selectedUri: Uri? = null

    private val filePicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            selectedUri = uri
            val cursor = contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIdx = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    val sizeIdx = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
                    tvFileName.text = if (nameIdx >= 0) it.getString(nameIdx) else "File"
                    val size = if (sizeIdx >= 0) it.getLong(sizeIdx) else 0L
                    tvFileSize.text = formatSize(size)
                }
            }
            btnSend.isEnabled = true
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_file_share)

        roomId = intent.getStringExtra("room_id") ?: return finish()
        roomName = intent.getStringExtra("room_name") ?: "Chat"

        tvFileName = findViewById(R.id.tvFileName)
        tvFileSize = findViewById(R.id.tvFileSize)
        btnSend = findViewById(R.id.btnSend)
        progress = findViewById(R.id.progress)

        findViewById<View>(R.id.btnBack)?.setOnClickListener { finish() }
        findViewById<View>(R.id.btnPickFile)?.setOnClickListener { filePicker.launch("*/*") }

        btnSend.isEnabled = false
        btnSend.setOnClickListener { sendFile() }

        // Handle shared files from other apps
        if (intent.action == Intent.ACTION_SEND) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            if (uri != null) {
                selectedUri = uri
                tvFileName.text = "Shared file"
                btnSend.isEnabled = true
            }
        }
    }

    private fun sendFile() {
        val uri = selectedUri ?: return
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return
        val baseUrl = app.securePrefs.serverUrl ?: return

        progress.visibility = View.VISIBLE
        btnSend.isEnabled = false

        lifecycleScope.launch {
            try {
                val tempFile = withContext(Dispatchers.IO) {
                    val input = contentResolver.openInputStream(uri) ?: return@withContext null
                    val file = File(cacheDir, "share_${System.currentTimeMillis()}")
                    file.outputStream().use { out -> input.copyTo(out) }
                    file
                } ?: return@launch

                val mediaManager = MediaManager(this@FileShareActivity, app.database, baseUrl)
                val mxcUrl = mediaManager.uploadMedia(tempFile, token)

                if (mxcUrl != null) {
                    val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                    val fileName = tvFileName.text.toString()
                    val encoded = java.net.URLEncoder.encode(roomId, "UTF-8")
                    val txn = "file${System.currentTimeMillis()}"
                    val body = Gson().toJson(mapOf(
                        "msgtype" to "m.file",
                        "body" to fileName,
                        "url" to mxcUrl,
                        "info" to mapOf("mimetype" to mimeType, "size" to tempFile.length()),
                        "filename" to fileName
                    ))
                    withContext(Dispatchers.IO) {
                        okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder()
                            .url("$baseUrl/_matrix/client/v3/rooms/$encoded/send/m.room.message/$txn")
                            .addHeader("Authorization", "Bearer $token")
                            .put(body.toRequestBody("application/json".toMediaType()))
                            .build()).execute()
                    }
                    tempFile.delete()
                    Toast.makeText(this@FileShareActivity, "File sent", Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    Toast.makeText(this@FileShareActivity, "Upload failed", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@FileShareActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
            progress.visibility = View.GONE
            btnSend.isEnabled = true
        }
    }

    private fun formatSize(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> "${bytes / (1024 * 1024)} MB"
    }
}
