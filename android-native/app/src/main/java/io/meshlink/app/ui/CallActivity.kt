package io.meshlink.app.ui

import android.Manifest
import android.content.pm.PackageManager
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
import kotlinx.coroutines.*
import org.webrtc.*

/**
 * Voice/Video call screen using WebRTC.
 * Connects to Matrix TURN server for NAT traversal.
 * Audio/video processed on device (99% local).
 */
class CallActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ROOM_ID = "room_id"
        const val EXTRA_CALL_TYPE = "call_type" // "voice" or "video"
        const val EXTRA_IS_INCOMING = "is_incoming"
        private const val PERMISSION_REQUEST = 100
    }

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var localVideoSource: VideoSource? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var eglBase: EglBase? = null

    private lateinit var localRenderer: SurfaceViewRenderer
    private lateinit var remoteRenderer: SurfaceViewRenderer
    private lateinit var tvCallStatus: TextView
    private lateinit var tvCallerName: TextView
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnMute: ImageButton
    private lateinit var btnCamera: ImageButton

    private var roomId: String = ""
    private var callType: String = "voice"
    private var isMuted = false
    private var isCameraOff = false
    private var callStartTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_call)

        roomId = intent.getStringExtra(EXTRA_ROOM_ID) ?: return finish()
        callType = intent.getStringExtra(EXTRA_CALL_TYPE) ?: "voice"

        localRenderer = findViewById(R.id.localRenderer)
        remoteRenderer = findViewById(R.id.remoteRenderer)
        tvCallStatus = findViewById(R.id.tvCallStatus)
        tvCallerName = findViewById(R.id.tvCallerName)
        btnEndCall = findViewById(R.id.btnEndCall)
        btnMute = findViewById(R.id.btnMute)
        btnCamera = findViewById(R.id.btnCamera)

        tvCallerName.text = intent.getStringExtra("caller_name") ?: "Call"
        tvCallStatus.text = "Connecting..."

        btnEndCall.setOnClickListener { endCall() }
        btnMute.setOnClickListener { toggleMute() }
        btnCamera.setOnClickListener { toggleCamera() }

        if (callType == "voice") {
            localRenderer.visibility = View.GONE
            remoteRenderer.visibility = View.GONE
            btnCamera.visibility = View.GONE
        }

        checkPermissionsAndStart()
    }

    private fun checkPermissionsAndStart() {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (callType == "video") perms.add(Manifest.permission.CAMERA)

        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isEmpty()) {
            initWebRTC()
        } else {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                initWebRTC()
            } else {
                Toast.makeText(this, "Permissions required for calls", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    private fun initWebRTC() {
        eglBase = EglBase.create()

        // Initialize WebRTC
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(this)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )

        val options = PeerConnectionFactory.Options()
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(options)
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase!!.eglBaseContext))
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase!!.eglBaseContext, true, true))
            .createPeerConnectionFactory()

        // Setup renderers
        if (callType == "video") {
            localRenderer.init(eglBase!!.eglBaseContext, null)
            localRenderer.setMirror(true)
            remoteRenderer.init(eglBase!!.eglBaseContext, null)
        }

        // Create audio track
        val audioConstraints = MediaConstraints()
        val audioSource = peerConnectionFactory!!.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory!!.createAudioTrack("audio0", audioSource)

        // Create video track (if video call)
        if (callType == "video") {
            videoCapturer = createCameraCapturer()
            if (videoCapturer != null) {
                localVideoSource = peerConnectionFactory!!.createVideoSource(videoCapturer!!.isScreencast)
                videoCapturer!!.initialize(
                    SurfaceTextureHelper.create("CaptureThread", eglBase!!.eglBaseContext),
                    this,
                    localVideoSource!!.capturerObserver
                )
                videoCapturer!!.startCapture(640, 480, 30)
                localVideoTrack = peerConnectionFactory!!.createVideoTrack("video0", localVideoSource)
                localVideoTrack!!.addSink(localRenderer)
            }
        }

        // Get TURN servers from Matrix
        getTurnServers()

        tvCallStatus.text = if (callType == "video") "Video call" else "Voice call"
        callStartTime = System.currentTimeMillis()

        // Start call duration timer
        CoroutineScope(Dispatchers.Main).launch {
            while (true) {
                delay(1000)
                val duration = (System.currentTimeMillis() - callStartTime) / 1000
                val min = duration / 60
                val sec = duration % 60
                tvCallStatus.text = String.format("%02d:%02d", min, sec)
            }
        }
    }

    private fun getTurnServers() {
        val app = MeshlinkApp.instance
        val token = app.securePrefs.accessToken ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Get TURN config from Matrix server
                val turnUrl = "${app.securePrefs.serverUrl}/_matrix/client/v3/voip/turnServer"
                val request = okhttp3.Request.Builder()
                    .url(turnUrl)
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                val response = okhttp3.OkHttpClient().newCall(request).execute()
                if (response.isSuccessful) {
                    val json = com.google.gson.JsonParser.parseString(response.body?.string() ?: "{}")
                        .asJsonObject
                    val uris = json.getAsJsonArray("uris")?.map { it.asString } ?: emptyList()
                    val username = json.get("username")?.asString ?: ""
                    val password = json.get("password")?.asString ?: ""

                    withContext(Dispatchers.Main) {
                        createPeerConnection(uris, username, password)
                    }
                }
            } catch (_: Exception) {
                // Fallback: try without TURN
                withContext(Dispatchers.Main) {
                    createPeerConnection(emptyList(), "", "")
                }
            }
        }
    }

    private fun createPeerConnection(turnUris: List<String>, turnUser: String, turnPass: String) {
        val iceServers = mutableListOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )

        for (uri in turnUris) {
            iceServers.add(
                PeerConnection.IceServer.builder(uri)
                    .setUsername(turnUser)
                    .setPassword(turnPass)
                    .createIceServer()
            )
        }

        val config = PeerConnection.RTCConfiguration(iceServers)
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN

        peerConnection = peerConnectionFactory!!.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                // Send ICE candidate to remote peer via Matrix
                candidate?.let { sendIceCandidate(it) }
            }
            override fun onAddStream(stream: MediaStream?) {
                stream?.videoTracks?.firstOrNull()?.let { track ->
                    runOnUiThread { track.addSink(remoteRenderer) }
                }
            }
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        })

        // Add local tracks
        localAudioTrack?.let { peerConnection?.addTrack(it) }
        localVideoTrack?.let { peerConnection?.addTrack(it) }
    }

    private fun sendIceCandidate(candidate: IceCandidate) {
        // In production: send via Matrix room events (m.call.candidates)
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(this)
        // Try front camera first
        for (name in enumerator.deviceNames) {
            if (enumerator.isFrontFacing(name)) {
                return enumerator.createCapturer(name, null)
            }
        }
        // Fallback to any camera
        for (name in enumerator.deviceNames) {
            return enumerator.createCapturer(name, null)
        }
        return null
    }

    private fun toggleMute() {
        isMuted = !isMuted
        localAudioTrack?.setEnabled(!isMuted)
        btnMute.alpha = if (isMuted) 0.4f else 1.0f
    }

    private fun toggleCamera() {
        isCameraOff = !isCameraOff
        localVideoTrack?.setEnabled(!isCameraOff)
        localRenderer.visibility = if (isCameraOff) View.GONE else View.VISIBLE
        btnCamera.alpha = if (isCameraOff) 0.4f else 1.0f
    }

    private fun endCall() {
        peerConnection?.close()
        peerConnection = null
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        localVideoSource?.dispose()
        peerConnectionFactory?.dispose()
        eglBase?.release()
        finish()
    }

    override fun onDestroy() {
        endCall()
        super.onDestroy()
    }
}
