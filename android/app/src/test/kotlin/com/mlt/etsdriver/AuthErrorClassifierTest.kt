package com.mlt.etsdriver

import org.junit.Test
import kotlin.test.assertIs
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthErrorClassifierTest {

    @Test
    fun `test success response parsing`() {
        val body = """{"success":true,"data":{"access_token":"abc123","refresh_token":"ref456","access_token_expires_in":86400,"refresh_token_expires_in":1296000}}"""
        val result = AuthErrorClassifier.classify(200, body)
        assertIs<AuthSuccess>(result)
        result as AuthSuccess
        assertEquals("abc123", result.accessToken)
        assertEquals("ref456", result.refreshToken)
        assertEquals(86400, result.accessTokenExpiresIn)
        assertEquals(1296000, result.refreshTokenExpiresIn)
    }

    @Test
    fun `test success without optional fields`() {
        val body = """{"success":true,"data":{"access_token":"abc123"}}"""
        val result = AuthErrorClassifier.classify(200, body)
        assertIs<AuthSuccess>(result)
        result as AuthSuccess
        assertEquals("abc123", result.accessToken)
        assertEquals(null, result.refreshToken)
        assertEquals(null, result.accessTokenExpiresIn)
    }

    @Test
    fun `test REFRESH_TOKEN_EXPIRED is permanent`() {
        val body = """{"success":false,"error":{"code":"REFRESH_TOKEN_EXPIRED","message":"Token expired"}}"""
        val result = AuthErrorClassifier.classify(401, body)
        assertIs<AuthPermanentFailure>(result)
        result as AuthPermanentFailure
        assertEquals("REFRESH_TOKEN_EXPIRED", result.code)
    }

    @Test
    fun `test REFRESH_TOKEN_INVALID is permanent`() {
        val body = """{"success":false,"error":{"code":"REFRESH_TOKEN_INVALID","message":"Invalid token"}}"""
        val result = AuthErrorClassifier.classify(401, body)
        assertIs<AuthPermanentFailure>(result)
    }

    @Test
    fun `test DRIVER_DISABLED is permanent`() {
        val body = """{"error_code":"DRIVER_DISABLED","message":"Account disabled"}"""
        val result = AuthErrorClassifier.classify(403, body)
        assertIs<AuthPermanentFailure>(result)
    }

    @Test
    fun `test TENANT_DISABLED is permanent`() {
        val body = """{"error":{"code":"TENANT_DISABLED","message":"Tenant disabled"}}"""
        val result = AuthErrorClassifier.classify(403, body)
        assertIs<AuthPermanentFailure>(result)
    }

    @Test
    fun `test 429 is temporary`() {
        val result = AuthErrorClassifier.classify(429, """{"message":"Rate limited"}""")
        assertIs<AuthTemporaryFailure>(result)
        result as AuthTemporaryFailure
        assertEquals("RATE_LIMITED", result.code)
    }

    @Test
    fun `test 500 is temporary`() {
        val result = AuthErrorClassifier.classify(500, """{"message":"Server error"}""")
        assertIs<AuthTemporaryFailure>(result)
        assertEquals("SERVER_ERROR", (result as AuthTemporaryFailure).code)
    }

    @Test
    fun `test 503 is temporary`() {
        val result = AuthErrorClassifier.classify(503, """{"message":"Service unavailable"}""")
        assertIs<AuthTemporaryFailure>(result)
    }

    @Test
    fun `test SocketTimeoutException is temporary`() {
        val result = AuthErrorClassifier.classifyException(java.net.SocketTimeoutException("timeout"))
        assertIs<AuthTemporaryFailure>(result)
        result as AuthTemporaryFailure
        assertEquals("TIMEOUT", result.code)
    }

    @Test
    fun `test UnknownHostException is temporary`() {
        val result = AuthErrorClassifier.classifyException(java.net.UnknownHostException("no host"))
        assertIs<AuthTemporaryFailure>(result)
        assertEquals("NETWORK_ERROR", (result as AuthTemporaryFailure).code)
    }

    @Test
    fun `test 401 without error code classifies as permanent`() {
        val result = AuthErrorClassifier.classify(401, """{"message":"Unauthorized"}""")
        assertIs<AuthPermanentFailure>(result)
        result as AuthPermanentFailure
        assertEquals("HTTP_401", result.code)
    }
}
