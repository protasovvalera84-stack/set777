package io.meshlink.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import io.meshlink.app.MeshlinkApp
import io.meshlink.app.R
import kotlinx.coroutines.launch

/**
 * Login/Register screen — first screen user sees.
 * Credentials stored in encrypted preferences.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var etServer: EditText
    private lateinit var etUsername: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var btnRegister: Button
    private lateinit var tvError: TextView
    private lateinit var progress: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = MeshlinkApp.instance

        // Auto-login if already logged in
        if (app.securePrefs.isLoggedIn) {
            startMain()
            return
        }

        setContentView(R.layout.activity_login)

        etServer = findViewById(R.id.etServer)
        etUsername = findViewById(R.id.etUsername)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        btnRegister = findViewById(R.id.btnRegister)
        tvError = findViewById(R.id.tvError)
        progress = findViewById(R.id.progress)

        // Pre-fill server URL
        etServer.setText(app.securePrefs.serverUrl ?: io.meshlink.app.BuildConfig.SERVER_URL)

        btnLogin.setOnClickListener { doAuth(isRegister = false) }
        btnRegister.setOnClickListener { doAuth(isRegister = true) }
    }

    private fun doAuth(isRegister: Boolean) {
        val server = etServer.text.toString().trim().removeSuffix("/")
        val user = etUsername.text.toString().trim()
        val pass = etPassword.text.toString()

        if (server.isEmpty() || user.isEmpty() || pass.length < 6) {
            tvError.text = "Fill all fields (password min 6 chars)"
            tvError.visibility = View.VISIBLE
            return
        }

        setLoading(true)
        tvError.visibility = View.GONE

        val app = MeshlinkApp.instance
        val api = app.matrixApi

        lifecycleScope.launch {
            try {
                val resp = if (isRegister) api.register(user, pass) else api.login(user, pass)

                if (resp.access_token != null && resp.user_id != null) {
                    // Save credentials securely
                    app.securePrefs.accessToken = resp.access_token
                    app.securePrefs.userId = resp.user_id
                    app.securePrefs.deviceId = resp.device_id
                    app.securePrefs.serverUrl = server
                    startMain()
                } else {
                    tvError.text = resp.error ?: "Authentication failed"
                    tvError.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                tvError.text = "Connection error: ${e.message}"
                tvError.visibility = View.VISIBLE
            }
            setLoading(false)
        }
    }

    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        btnLogin.isEnabled = !loading
        btnRegister.isEnabled = !loading
    }

    private fun startMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
