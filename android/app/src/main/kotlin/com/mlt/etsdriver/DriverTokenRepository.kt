package com.mlt.etsdriver

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class DriverTokenRepository private constructor(appContext: Context) {

    companion object {
        private const val TAG = "MLT_TokenRepository"
        private const val PREFS_NAME = "mlt_secure_token_store"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_ACCESS_TOKEN_EXPIRES_AT = "access_token_expires_at"
        private const val KEY_REFRESH_TOKEN_EXPIRES_AT = "refresh_token_expires_at"
        private const val KEY_TOKEN_TYPE = "token_type"
        private const val KEY_DRIVER_ID = "driver_id"
        private const val KEY_TENANT_ID = "tenant_id"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_TOKEN_VERSION = "token_version"
        private const val KEY_LAST_UPDATE_TIME = "last_token_update_time"
        private const val KEY_AUTH_STATE = "authentication_state"

        @Volatile
        private var instance: DriverTokenRepository? = null

        fun getInstance(context: Context): DriverTokenRepository {
            return instance ?: synchronized(this) {
                instance ?: DriverTokenRepository(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    enum class AuthenticationState {
        AUTHENTICATED,
        REQUIRES_LOGIN,
        UNKNOWN
    }

    data class TokenSet(
        val accessToken: String = "",
        val refreshToken: String? = null,
        val accessTokenExpiresAt: Long? = null,
        val refreshTokenExpiresAt: Long? = null,
        val tokenType: String? = null,
        val driverId: String? = null,
        val tenantId: String? = null,
        val deviceId: String? = null,
        val tokenVersion: Long = 0,
        val lastUpdateTime: Long = 0,
        val authenticationState: AuthenticationState = AuthenticationState.UNKNOWN
    )

    private val lock = ReentrantReadWriteLock()
    private val prefs: SharedPreferences

    init {
        prefs = try {
            val masterKey = MasterKey.Builder(appContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                appContext,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.w(TAG, "EncryptedSharedPreferences init failed, falling back to regular prefs: ${e.message}")
            appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    fun readTokens(): TokenSet {
        return lock.read {
            TokenSet(
                accessToken = prefs.getString(KEY_ACCESS_TOKEN, "") ?: "",
                refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null),
                accessTokenExpiresAt = if (prefs.contains(KEY_ACCESS_TOKEN_EXPIRES_AT))
                    prefs.getLong(KEY_ACCESS_TOKEN_EXPIRES_AT, 0L) else null,
                refreshTokenExpiresAt = if (prefs.contains(KEY_REFRESH_TOKEN_EXPIRES_AT))
                    prefs.getLong(KEY_REFRESH_TOKEN_EXPIRES_AT, 0L) else null,
                tokenType = prefs.getString(KEY_TOKEN_TYPE, null),
                driverId = prefs.getString(KEY_DRIVER_ID, null),
                tenantId = prefs.getString(KEY_TENANT_ID, null),
                deviceId = prefs.getString(KEY_DEVICE_ID, null),
                tokenVersion = prefs.getLong(KEY_TOKEN_VERSION, 0L),
                lastUpdateTime = prefs.getLong(KEY_LAST_UPDATE_TIME, 0L),
                authenticationState = parseAuthState(
                    prefs.getString(KEY_AUTH_STATE, AuthenticationState.AUTHENTICATED.name)
                )
            )
        }
    }

    fun saveTokens(tokens: TokenSet) {
        lock.write {
            val nextVersion = prefs.getLong(KEY_TOKEN_VERSION, 0L) + 1
            prefs.edit()
                .putString(KEY_ACCESS_TOKEN, tokens.accessToken)
                .putString(KEY_REFRESH_TOKEN, tokens.refreshToken)
                .putLong(KEY_TOKEN_VERSION, nextVersion)
                .putLong(KEY_LAST_UPDATE_TIME, System.currentTimeMillis())
                .putString(KEY_AUTH_STATE, AuthenticationState.AUTHENTICATED.name)
                .apply()

            if (tokens.accessTokenExpiresAt != null) {
                prefs.edit().putLong(KEY_ACCESS_TOKEN_EXPIRES_AT, tokens.accessTokenExpiresAt).apply()
            } else {
                prefs.edit().remove(KEY_ACCESS_TOKEN_EXPIRES_AT).apply()
            }

            if (tokens.refreshTokenExpiresAt != null) {
                prefs.edit().putLong(KEY_REFRESH_TOKEN_EXPIRES_AT, tokens.refreshTokenExpiresAt).apply()
            } else {
                prefs.edit().remove(KEY_REFRESH_TOKEN_EXPIRES_AT).apply()
            }

            tokens.tokenType?.let { prefs.edit().putString(KEY_TOKEN_TYPE, it).apply() }
            tokens.driverId?.let { prefs.edit().putString(KEY_DRIVER_ID, it).apply() }
            tokens.tenantId?.let { prefs.edit().putString(KEY_TENANT_ID, it).apply() }
            tokens.deviceId?.let { prefs.edit().putString(KEY_DEVICE_ID, it).apply() }

            Log.i(TAG, "Tokens saved (version=$nextVersion)")
        }
    }

    fun clearTokens(clearVersion: Boolean = true) {
        lock.write {
            val edit = prefs.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_ACCESS_TOKEN_EXPIRES_AT)
                .remove(KEY_REFRESH_TOKEN_EXPIRES_AT)
                .remove(KEY_TOKEN_TYPE)
                .remove(KEY_DRIVER_ID)
                .remove(KEY_TENANT_ID)
                .remove(KEY_DEVICE_ID)
                .remove(KEY_LAST_UPDATE_TIME)
                .putString(KEY_AUTH_STATE, AuthenticationState.REQUIRES_LOGIN.name)
            if (clearVersion) {
                edit.remove(KEY_TOKEN_VERSION)
            }
            edit.apply()
            Log.i(TAG, "Tokens cleared")
        }
    }

    fun getTokenVersion(): Long {
        return lock.read { prefs.getLong(KEY_TOKEN_VERSION, 0L) }
    }

    fun hasTokens(): Boolean {
        return lock.read {
            val token = prefs.getString(KEY_ACCESS_TOKEN, "") ?: ""
            token.isNotEmpty()
        }
    }

    fun getAccessToken(): String {
        return lock.read { prefs.getString(KEY_ACCESS_TOKEN, "") ?: "" }
    }

    fun getAuthenticationState(): AuthenticationState {
        return lock.read {
            parseAuthState(prefs.getString(KEY_AUTH_STATE, AuthenticationState.AUTHENTICATED.name))
        }
    }

    fun markRequiresLogin() {
        lock.write {
            prefs.edit()
                .putString(KEY_AUTH_STATE, AuthenticationState.REQUIRES_LOGIN.name)
                .apply()
            Log.i(TAG, "Auth state marked as REQUIRES_LOGIN")
        }
    }

    fun markAuthenticated() {
        lock.write {
            prefs.edit()
                .putString(KEY_AUTH_STATE, AuthenticationState.AUTHENTICATED.name)
                .apply()
            Log.i(TAG, "Auth state marked as AUTHENTICATED")
        }
    }

    fun setDriverMetadata(driverId: String?, tenantId: String?, deviceId: String?) {
        lock.write {
            val edit = prefs.edit()
            driverId?.let { edit.putString(KEY_DRIVER_ID, it) }
            tenantId?.let { edit.putString(KEY_TENANT_ID, it) }
            deviceId?.let { edit.putString(KEY_DEVICE_ID, it) }
            edit.apply()
        }
    }

    private fun parseAuthState(value: String?): AuthenticationState {
        return when (value) {
            AuthenticationState.AUTHENTICATED.name -> AuthenticationState.AUTHENTICATED
            AuthenticationState.REQUIRES_LOGIN.name -> AuthenticationState.REQUIRES_LOGIN
            else -> AuthenticationState.UNKNOWN
        }
    }

    fun getTokenVersionLock(): ReentrantReadWriteLock = lock
    fun getPrefs(): SharedPreferences = prefs
}
