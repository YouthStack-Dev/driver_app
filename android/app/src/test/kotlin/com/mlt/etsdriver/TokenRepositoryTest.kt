package com.mlt.etsdriver

import org.junit.Before
import org.junit.Test
import kotlin.test.*

class TokenRepositoryTest {

    private lateinit var repo: InMemoryTokenRepository

    @Before
    fun setUp() {
        repo = InMemoryTokenRepository()
    }

    @Test
    fun `test save and read tokens`() {
        val tokens = createTokenSet(
            accessToken = "access123",
            refreshToken = "refresh456",
            driverId = "driver1",
            tenantId = "tenant1"
        )
        repo.saveTokens(tokens)
        val read = repo.readTokens()
        assertEquals("access123", read.accessToken)
        assertEquals("refresh456", read.refreshToken)
        assertEquals("driver1", read.driverId)
        assertEquals("tenant1", read.tenantId)
        assertTrue(read.tokenVersion > 0)
    }

    @Test
    fun `test clear tokens`() {
        repo.saveTokens(createTokenSet(accessToken = "access123"))
        assertTrue(repo.hasTokens())
        repo.clearTokens()
        assertFalse(repo.hasTokens())
        assertEquals(DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN, repo.getAuthenticationState())
    }

    @Test
    fun `test token version increments on each save`() {
        repo.saveTokens(createTokenSet(accessToken = "token1"))
        val v1 = repo.getTokenVersion()
        repo.saveTokens(createTokenSet(accessToken = "token2"))
        val v2 = repo.getTokenVersion()
        assertTrue(v2 > v1)
    }

    @Test
    fun `test mark requires login`() {
        assertEquals(DriverTokenRepository.AuthenticationState.UNKNOWN, repo.getAuthenticationState())
        repo.saveTokens(createTokenSet(accessToken = "tok"))
        assertEquals(DriverTokenRepository.AuthenticationState.AUTHENTICATED, repo.getAuthenticationState())
        repo.markRequiresLogin()
        assertEquals(DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN, repo.getAuthenticationState())
    }

    @Test
    fun `test hasTokens returns false when no tokens saved`() {
        assertFalse(repo.hasTokens())
    }

    @Test
    fun `test hasTokens returns true after save`() {
        repo.saveTokens(createTokenSet(accessToken = "tok"))
        assertTrue(repo.hasTokens())
    }

    @Test
    fun `test setDriverMetadata`() {
        repo.setDriverMetadata("driver1", "tenant1", "device1")
        val tokens = repo.readTokens()
        assertEquals("driver1", tokens.driverId)
        assertEquals("tenant1", tokens.tenantId)
    }

    @Test
    fun `test concurrent saves preserve last write`() {
        val threads = List(10) { index ->
            Thread {
                repo.saveTokens(createTokenSet(accessToken = "token_$index"))
            }
        }
        threads.forEach { it.start() }
        threads.forEach { it.join() }
        val finalTokens = repo.readTokens()
        assertTrue(finalTokens.accessToken.startsWith("token_"))
        assertTrue(finalTokens.tokenVersion > 0)
    }

    @Test
    fun `test markAuthenticated`() {
        repo.saveTokens(createTokenSet(accessToken = "tok"))
        repo.markRequiresLogin()
        assertEquals(DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN, repo.getAuthenticationState())
        repo.markAuthenticated()
        assertEquals(DriverTokenRepository.AuthenticationState.AUTHENTICATED, repo.getAuthenticationState())
    }

    @Test
    fun `test getAccessToken`() {
        repo.saveTokens(createTokenSet(accessToken = "my_token"))
        assertEquals("my_token", repo.getAccessToken())
    }

    @Test
    fun `test getAccessToken returns empty when no token`() {
        assertEquals("", repo.getAccessToken())
    }

    private fun createTokenSet(
        accessToken: String = "",
        refreshToken: String? = null,
        driverId: String? = null,
        tenantId: String? = null
    ): DriverTokenRepository.TokenSet {
        return DriverTokenRepository.TokenSet(
            accessToken = accessToken,
            refreshToken = refreshToken,
            driverId = driverId,
            tenantId = tenantId,
            authenticationState = DriverTokenRepository.AuthenticationState.AUTHENTICATED
        )
    }
}

class InMemoryTokenRepository {
    private var tokens = DriverTokenRepository.TokenSet()
    private var authState = DriverTokenRepository.AuthenticationState.UNKNOWN
    private var version: Long = 0
    private val lock = Any()

    fun readTokens(): DriverTokenRepository.TokenSet {
        synchronized(lock) { return tokens }
    }

    fun saveTokens(t: DriverTokenRepository.TokenSet) {
        synchronized(lock) {
            version++
            tokens = t.copy(
                tokenVersion = version,
                lastUpdateTime = System.currentTimeMillis(),
                authenticationState = DriverTokenRepository.AuthenticationState.AUTHENTICATED
            )
        }
    }

    fun clearTokens(clearVersion: Boolean = true) {
        synchronized(lock) {
            tokens = DriverTokenRepository.TokenSet()
            if (clearVersion) version = 0
            authState = DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN
        }
    }

    fun getTokenVersion(): Long = synchronized(lock) { version }
    fun hasTokens(): Boolean = synchronized(lock) { tokens.accessToken.isNotEmpty() }
    fun getAccessToken(): String = synchronized(lock) { tokens.accessToken }

    fun getAuthenticationState(): DriverTokenRepository.AuthenticationState {
        synchronized(lock) {
            if (tokens.accessToken.isNotEmpty() && authState != DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN) {
                return DriverTokenRepository.AuthenticationState.AUTHENTICATED
            }
            return authState
        }
    }

    fun markRequiresLogin() { synchronized(lock) { authState = DriverTokenRepository.AuthenticationState.REQUIRES_LOGIN } }
    fun markAuthenticated() { synchronized(lock) { authState = DriverTokenRepository.AuthenticationState.AUTHENTICATED } }

    fun setDriverMetadata(driverId: String?, tenantId: String?, deviceId: String?) {
        synchronized(lock) {
            tokens = tokens.copy(
                driverId = driverId ?: tokens.driverId,
                tenantId = tenantId ?: tokens.tenantId,
                deviceId = deviceId ?: tokens.deviceId
            )
        }
    }
}
