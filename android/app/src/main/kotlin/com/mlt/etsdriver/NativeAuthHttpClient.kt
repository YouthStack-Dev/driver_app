package com.mlt.etsdriver

import android.util.Log
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class NativeAuthHttpClient(
    private val baseUrl: String = "https://api.mltcorporate.com"
) {
    companion object {
        private const val TAG = "MLT_NativeAuthHttp"
        private const val TIMEOUT_MS = 15_000
    }

    fun refreshToken(refreshToken: String): AuthResult {
        return try {
            val url = URL("$baseUrl/api/v1/auth/driver/refresh")
            val conn = url.openConnection() as HttpURLConnection
            conn.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
            }

            val body = JSONObject().apply {
                put("refresh_token", refreshToken)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }

            val statusCode = conn.responseCode
            val responseBody = try {
                if (statusCode in 200..299) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else {
                    conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                }
            } catch (ex: Exception) {
                ""
            }
            conn.disconnect()

            Log.i(TAG, "Refresh response: status=$statusCode body=${responseBody.take(200)}")

            AuthErrorClassifier.classify(statusCode, responseBody)

        } catch (e: Exception) {
            Log.w(TAG, "Refresh HTTP exception: ${e.message}")
            AuthErrorClassifier.classifyException(e)
        }
    }

    fun sendAuthenticatedPost(
        urlString: String,
        accessToken: String,
        queryParams: Map<String, String> = emptyMap(),
        headers: Map<String, String> = emptyMap(),
        body: String = ""
    ): HttpResult {
        return try {
            val fullUrl = if (queryParams.isNotEmpty()) {
                val params = queryParams.entries.joinToString("&") { "${it.key}=${java.net.URLEncoder.encode(it.value, "UTF-8")}" }
                "$urlString?$params"
            } else {
                urlString
            }

            val conn = URL(fullUrl).openConnection() as HttpURLConnection
            conn.apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $accessToken")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                headers.forEach { (k, v) -> setRequestProperty(k, v) }
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = body.isNotEmpty()
            }

            if (body.isNotEmpty()) {
                OutputStreamWriter(conn.outputStream).use { it.write(body) }
            }

            val statusCode = conn.responseCode
            val responseBody = try {
                if (statusCode in 200..299) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else {
                    conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                }
            } catch (ex: Exception) {
                "Failed to read body: ${ex.message}"
            }
            conn.disconnect()

            HttpResult(statusCode, responseBody)

        } catch (e: Exception) {
            HttpResult(-1, "Exception: ${e.message}")
        }
    }

    data class HttpResult(val statusCode: Int, val responseBody: String) {
        val isSuccess: Boolean get() = statusCode in 200..299
        val isAuthError: Boolean get() = statusCode == 401 || statusCode == 403
        val isTemporaryError: Boolean get() = statusCode == 429 || (statusCode in 500..599)
        val isNetworkError: Boolean get() = statusCode <= 0
    }
}
