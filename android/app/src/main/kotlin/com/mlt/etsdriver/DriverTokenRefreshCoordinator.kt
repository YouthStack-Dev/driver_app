package com.mlt.etsdriver

import android.util.Log
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class DriverTokenRefreshCoordinator(
    private val tokenRepository: DriverTokenRepository,
    private val httpClient: NativeAuthHttpClient
) {
    companion object {
        private const val TAG = "MLT_RefreshCoord"
        private const val ACCESS_TOKEN_RENEWAL_THRESHOLD_MS = 300_000L
    }

    private val mutex = Mutex()
    private var lastRefreshAttemptTime: Long = 0
    private var lastRefreshResult: RefreshResult = RefreshResult.TemporaryFailure("Not attempted")

    sealed class RefreshResult {
        data class Success(
            val newAccessToken: String,
            val newRefreshToken: String?,
            val accessTokenExpiresAt: Long?,
            val refreshTokenExpiresAt: Long?
        ) : RefreshResult()

        data class PermanentFailure(val code: String, val message: String) : RefreshResult()
        data class TemporaryFailure(val message: String) : RefreshResult()
        data class NotNeeded(val accessToken: String) : RefreshResult()
    }

    suspend fun refreshIfNeeded(): RefreshResult {
        return mutex.withLock {
            val authState = tokenRepository.getAuthenticationState()
            if (authState == DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN) {
                Log.w(TAG, "Auth state is REQUIRES_LOGIN — skipping refresh")
                return RefreshResult.PermanentFailure("SESSION_REQUIRES_LOGIN", "Session requires login")
            }

            val tokens = tokenRepository.readTokens()

            if (tokens.accessToken.isEmpty()) {
                Log.w(TAG, "No access token found — skipping refresh")
                return RefreshResult.PermanentFailure("NO_TOKEN", "No access token")
            }

            val accessExpiresAt = tokens.accessTokenExpiresAt
            if (accessExpiresAt != null && System.currentTimeMillis() < accessExpiresAt - ACCESS_TOKEN_RENEWAL_THRESHOLD_MS) {
                Log.i(TAG, "Access token still valid — no refresh needed")
                return RefreshResult.NotNeeded(tokens.accessToken)
            }

            performRefresh(tokens)
        }
    }

    suspend fun refreshForToken(usedToken: String): RefreshResult {
        return mutex.withLock {
            val tokens = tokenRepository.readTokens()

            if (tokens.accessToken != usedToken && tokens.accessToken.isNotEmpty()) {
                Log.i(TAG, "Token already refreshed by another component — using latest")
                return RefreshResult.NotNeeded(tokens.accessToken)
            }

            if (tokens.accessToken.isEmpty()) {
                Log.w(TAG, "No access token in repository")
                return RefreshResult.PermanentFailure("NO_TOKEN", "No access token")
            }

            performRefresh(tokens)
        }
    }

    private fun performRefresh(tokens: DriverTokenRepository.TokenSet): RefreshResult {
        val refreshToken = tokens.refreshToken
        if (refreshToken.isNullOrEmpty()) {
            Log.w(TAG, "No refresh token available")
            tokenRepository.markRequiresLogin()
            return RefreshResult.PermanentFailure("NO_REFRESH_TOKEN", "No refresh token")
        }

        val now = System.currentTimeMillis()
        if (now - lastRefreshAttemptTime < 10_000L) {
            Log.w(TAG, "Refresh attempted too recently — reusing last result")
            return lastRefreshResult
        }
        lastRefreshAttemptTime = now

        val refreshTokenExpiresAt = tokens.refreshTokenExpiresAt
        if (refreshTokenExpiresAt != null && now >= refreshTokenExpiresAt) {
            Log.w(TAG, "Refresh token expired")
            tokenRepository.markRequiresLogin()
            val result = RefreshResult.PermanentFailure("REFRESH_TOKEN_EXPIRED", "Refresh token has expired")
            lastRefreshResult = result
            return result
        }

        Log.i(TAG, "Initiating token refresh...")
        val authResult = httpClient.refreshToken(refreshToken)

        return when (authResult) {
            is AuthSuccess -> {
                val accessExpiresAt = authResult.accessTokenExpiresIn?.let {
                    System.currentTimeMillis() + (it * 1000)
                }
                val refreshExpiresAt = authResult.refreshTokenExpiresIn?.let {
                    System.currentTimeMillis() + (it * 1000)
                }

                val newTokens = DriverTokenRepository.TokenSet(
                    accessToken = authResult.accessToken,
                    refreshToken = authResult.refreshToken ?: refreshToken,
                    accessTokenExpiresAt = accessExpiresAt,
                    refreshTokenExpiresAt = refreshExpiresAt,
                    driverId = tokens.driverId,
                    tenantId = tokens.tenantId,
                    deviceId = tokens.deviceId,
                    tokenType = tokens.tokenType,
                    authenticationState = DriverTokenRepository.AuthenticationState.AUTHENTICATED
                )

                tokenRepository.saveTokens(newTokens)

                val result = RefreshResult.Success(
                    newAccessToken = authResult.accessToken,
                    newRefreshToken = authResult.refreshToken,
                    accessTokenExpiresAt = accessExpiresAt,
                    refreshTokenExpiresAt = refreshExpiresAt
                )
                lastRefreshResult = result
                Log.i(TAG, "Token refresh succeeded")
                result
            }
            is AuthPermanentFailure -> {
                tokenRepository.markRequiresLogin()
                val result = RefreshResult.PermanentFailure(authResult.code, authResult.message)
                lastRefreshResult = result
                Log.w(TAG, "Token refresh permanent failure: ${authResult.code}")
                result
            }
            is AuthTemporaryFailure -> {
                val result = RefreshResult.TemporaryFailure("${authResult.code}: ${authResult.message}")
                lastRefreshResult = result
                Log.w(TAG, "Token refresh temporary failure: ${authResult.code}")
                result
            }
        }
    }

    fun clearLastResult() {
        lastRefreshAttemptTime = 0
        lastRefreshResult = RefreshResult.TemporaryFailure("Cleared")
    }

    suspend fun forceRefresh(): RefreshResult {
        return mutex.withLock {
            val tokens = tokenRepository.readTokens()
            if (tokens.accessToken.isEmpty()) {
                return RefreshResult.PermanentFailure("NO_TOKEN", "No access token")
            }
            performRefresh(tokens)
        }
    }
}
