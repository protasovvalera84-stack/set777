package io.meshlink.app

import android.app.Application
import io.meshlink.app.data.MeshlinkDatabase
import io.meshlink.app.network.MatrixApi
import io.meshlink.app.util.SecurePrefs

/**
 * Meshlink Application — initializes core components.
 * All data stored in app's private directory (auto-deleted on uninstall).
 */
class MeshlinkApp : Application() {

    lateinit var database: MeshlinkDatabase
        private set
    lateinit var matrixApi: MatrixApi
        private set
    lateinit var securePrefs: SecurePrefs
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize encrypted preferences (stores tokens securely)
        securePrefs = SecurePrefs(this)

        // Initialize local database (SQLite in app's private dir)
        database = MeshlinkDatabase.create(this)

        // Initialize Matrix API client
        val serverUrl = securePrefs.serverUrl ?: BuildConfig.SERVER_URL
        matrixApi = MatrixApi(serverUrl)
    }

    companion object {
        lateinit var instance: MeshlinkApp
            private set
    }
}
