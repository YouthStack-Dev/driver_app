package com.mlt.etsdriver

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    companion object {
        const val TRACKING_CHANNEL = "mlt_driver/tracking"
        const val AUTH_CHANNEL = "mlt_driver/auth"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, TRACKING_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "startBackgroundTracking" -> {
                        val serviceIntent = Intent(this, LocationForegroundService::class.java).apply {
                            action = LocationForegroundService.ACTION_START
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(serviceIntent)
                        } else {
                            startService(serviceIntent)
                        }
                        result.success(true)
                    }
                    "stopBackgroundTracking" -> {
                        val serviceIntent = Intent(this, LocationForegroundService::class.java).apply {
                            action = LocationForegroundService.ACTION_STOP
                        }
                        startService(serviceIntent)
                        result.success(true)
                    }
                    "isTrackingRunning" -> {
                        result.success(LocationForegroundService.isServiceRunning)
                    }
                    "updateToken" -> {
                        val token = call.argument<String>("token")
                        if (token != null) {
                            DriverTokenRepository.getInstance(this).let { repo ->
                                val current = repo.readTokens()
                                repo.saveTokens(current.copy(accessToken = token))
                            }
                            result.success(true)
                        } else {
                            result.error("INVALID_ARGUMENT", "Token is null", null)
                        }
                    }
                    "updateRoute" -> {
                        val routeId = call.argument<String>("routeId")
                        if (routeId != null) {
                            val prefs = getSharedPreferences(LocationForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
                            prefs.edit().putString(LocationForegroundService.KEY_ROUTE_ID, routeId).apply()
                            result.success(true)
                        } else {
                            result.error("INVALID_ARGUMENT", "Route ID is null", null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, AUTH_CHANNEL)
            .setMethodCallHandler { call, result ->
                val repo = DriverTokenRepository.getInstance(this)
                when (call.method) {
                    "getTokens" -> {
                        val tokens = repo.readTokens()
                        val map = HashMap<String, Any?>()
                        map["access_token"] = tokens.accessToken
                        map["refresh_token"] = tokens.refreshToken
                        map["access_token_expires_at"] = tokens.accessTokenExpiresAt
                        map["refresh_token_expires_at"] = tokens.refreshTokenExpiresAt
                        map["token_type"] = tokens.tokenType
                        map["driver_id"] = tokens.driverId
                        map["tenant_id"] = tokens.tenantId
                        map["device_id"] = tokens.deviceId
                        map["token_version"] = tokens.tokenVersion
                        map["last_update_time"] = tokens.lastUpdateTime
                        map["authentication_state"] = tokens.authenticationState.name
                        result.success(map)
                    }
                    "saveTokens" -> {
                        try {
                            val args = call.arguments as? Map<String, Any?>
                            if (args != null) {
                                val current = repo.readTokens()
                                repo.saveTokens(current.copy(
                                    accessToken = args["access_token"] as? String ?: current.accessToken,
                                    refreshToken = args["refresh_token"] as? String ?: current.refreshToken,
                                    accessTokenExpiresAt = (args["access_token_expires_at"] as? Number)?.toLong() ?: current.accessTokenExpiresAt,
                                    refreshTokenExpiresAt = (args["refresh_token_expires_at"] as? Number)?.toLong() ?: current.refreshTokenExpiresAt,
                                    driverId = args["driver_id"] as? String ?: current.driverId,
                                    tenantId = args["tenant_id"] as? String ?: current.tenantId,
                                    tokenType = args["token_type"] as? String ?: current.tokenType,
                                    authenticationState = DriverTokenRepository.AuthenticationState.AUTHENTICATED
                                ))
                                result.success(true)
                            } else {
                                result.error("INVALID_ARGUMENT", "Arguments is null", null)
                            }
                        } catch (e: Exception) {
                            result.error("SAVE_ERROR", e.message, null)
                        }
                    }
                    "clearTokens" -> {
                        repo.clearTokens()
                        result.success(true)
                    }
                    "getTokenVersion" -> {
                        result.success(repo.getTokenVersion())
                    }
                    "getAuthState" -> {
                        result.success(repo.getAuthenticationState().name)
                    }
                    "setAuthState" -> {
                        val state = call.argument<String>("state")
                        if (state == "REQUIRES_LOGIN") {
                            repo.markRequiresLogin()
                        } else if (state == "AUTHENTICATED") {
                            repo.markAuthenticated()
                        }
                        result.success(true)
                    }
                    "hasTokens" -> {
                        result.success(repo.hasTokens())
                    }
                    "setDriverMetadata" -> {
                        val driverId = call.argument<String>("driver_id")
                        val tenantId = call.argument<String>("tenant_id")
                        val deviceId = call.argument<String>("device_id")
                        repo.setDriverMetadata(driverId, tenantId, deviceId)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
