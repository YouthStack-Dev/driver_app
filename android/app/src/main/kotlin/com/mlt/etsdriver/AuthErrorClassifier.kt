package com.mlt.etsdriver

import org.json.JSONObject

sealed class AuthResult

data class AuthSuccess(
    val accessToken: String,
    val refreshToken: String?,
    val accessTokenExpiresIn: Long?,
    val refreshTokenExpiresIn: Long?
) : AuthResult()

data class AuthPermanentFailure(
    val code: String,
    val message: String
) : AuthResult()

data class AuthTemporaryFailure(
    val code: String,
    val message: String
) : AuthResult()

object AuthErrorClassifier {

    private val permanentErrorCodes = setOf(
        "REFRESH_TOKEN_EXPIRED",
        "REFRESH_TOKEN_INVALID",
        "REFRESH_TOKEN_REVOKED",
        "REFRESH_TOKEN_REUSED",
        "SESSION_INVALIDATED",
        "DRIVER_DISABLED",
        "TENANT_DISABLED",
        "DEVICE_MISMATCH",
        "TENANT_MISMATCH",
        "ACCOUNT_INACTIVE"
    )

    fun classify(statusCode: Int, responseBody: String?): AuthResult {
        val errorCode = extractErrorCode(responseBody)

        if (errorCode != null && errorCode in permanentErrorCodes) {
            return AuthPermanentFailure(errorCode, extractMessage(responseBody))
        }

        return when (statusCode) {
            in 200..299 -> parseSuccess(responseBody)
            400, 401, 403 -> {
                if (errorCode != null) {
                    AuthPermanentFailure(errorCode, extractMessage(responseBody))
                } else {
                    AuthPermanentFailure("HTTP_${statusCode}", "HTTP $statusCode")
                }
            }
            429 -> AuthTemporaryFailure("RATE_LIMITED", "Too many requests")
            in 500..599 -> AuthTemporaryFailure("SERVER_ERROR", "Server error $statusCode")
            else -> AuthTemporaryFailure("UNKNOWN", "Unknown error $statusCode")
        }
    }

    fun classifyException(exception: Exception): AuthResult {
        val message = exception.message ?: exception.toString()
        return when {
            exception is java.net.SocketTimeoutException ->
                AuthTemporaryFailure("TIMEOUT", message)
            exception is java.net.UnknownHostException ->
                AuthTemporaryFailure("NETWORK_ERROR", message)
            exception is java.net.ConnectException ->
                AuthTemporaryFailure("NETWORK_ERROR", message)
            exception is javax.net.ssl.SSLException ->
                AuthTemporaryFailure("NETWORK_ERROR", message)
            else ->
                AuthTemporaryFailure("NETWORK_ERROR", message)
        }
    }

    private fun parseSuccess(responseBody: String?): AuthResult {
        if (responseBody == null) return AuthTemporaryFailure("EMPTY_RESPONSE", "Empty response")

        return try {
            val json = JSONObject(responseBody)
            if (json.optBoolean("success", false)) {
                val data = json.optJSONObject("data")
                if (data != null) {
                    AuthSuccess(
                        accessToken = data.optString("access_token", ""),
                        refreshToken = data.optString("refresh_token", null),
                        accessTokenExpiresIn = if (data.has("access_token_expires_in"))
                            data.optLong("access_token_expires_in") else null,
                        refreshTokenExpiresIn = if (data.has("refresh_token_expires_in"))
                            data.optLong("refresh_token_expires_in") else null
                    )
                } else {
                    AuthTemporaryFailure("PARSE_ERROR", "Missing data envelope")
                }
            } else {
                val errorCode = extractErrorCode(responseBody)
                if (errorCode != null && errorCode in permanentErrorCodes) {
                    AuthPermanentFailure(errorCode, extractMessage(responseBody))
                } else {
                    AuthTemporaryFailure("API_ERROR", extractMessage(responseBody))
                }
            }
        } catch (e: Exception) {
            AuthTemporaryFailure("PARSE_ERROR", "Failed to parse response: ${e.message}")
        }
    }

    private fun extractErrorCode(responseBody: String?): String? {
        if (responseBody == null) return null
        return try {
            val json = JSONObject(responseBody)
            if (json.has("error") && json.get("error") is JSONObject) {
                json.getJSONObject("error").optString("code", null)
            } else {
                json.optString("error_code", null) ?: json.optString("code", null)
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun extractMessage(responseBody: String?): String {
        if (responseBody == null) return "Unknown error"
        return try {
            val json = JSONObject(responseBody)
            if (json.has("error") && json.get("error") is JSONObject) {
                json.getJSONObject("error").optString("message",
                    json.getJSONObject("error").optString("detail", "Unknown error"))
            } else {
                json.optString("message", json.optString("detail", "Unknown error"))
            }
        } catch (e: Exception) {
            "Parse error: ${e.message}"
        }
    }
}
