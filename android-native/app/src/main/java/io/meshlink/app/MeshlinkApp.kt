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
    lateinit var e2ee: io.meshlink.app.network.E2EEncryption
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        securePrefs = SecurePrefs(this)
        database = MeshlinkDatabase.create(this)

        val serverUrl = securePrefs.serverUrl ?: BuildConfig.SERVER_URL
        matrixApi = MatrixApi(serverUrl)

        // Initialize E2E encryption
        e2ee = io.meshlink.app.network.E2EEncryption(securePrefs)
        e2ee.init()
    }

    companion object {
        lateinit var instance: MeshlinkApp
            private set
    }
}
