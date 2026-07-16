import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/navigation_service.dart';
import 'package:dio/io.dart';
import '../config/constants.dart';
import 'auth_service.dart';
import 'session_service.dart';
import 'location_service.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  late Dio _dio;

  // Callback set by AuthProvider so ApiClient can trigger a full logout
  // (stopping background services, clearing state, notifying listeners)
  // instead of just clearing the session storage.
  Future<void> Function()? _logoutCallback;
  DateTime? _lastLogoutAttempt;
  
  // Cooldown for proactive refresh to avoid hammering the refresh endpoint
  DateTime? _lastProactiveRefresh;
  static const _proactiveRefreshCooldown = Duration(minutes: 2);

  /// Register the full logout handler (called by AuthProvider at startup).
  void setLogoutCallback(Future<void> Function() callback) {
    _logoutCallback = callback;
  }

  factory ApiClient() => _instance;

  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      // Mobile networks can be slow — 10 s is too short for a driver app.
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Allow self-signed certificates (Fix for HandshakeException)
    (_dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
      final client = HttpClient();
      client.badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
      return client;
    };

    _dio.interceptors.add(InterceptorsWrapper(
      // ── Request ────────────────────────────────────────────────────────────
      onRequest: (options, handler) async {
        // 1. Proactive Refresh (avoid most 401s completely)
        // Also skip for logout — refreshing before logout causes a deadlock
        // when the refresh itself has already failed (e.g. DEVICE_CONFLICT).
        if (options.path != ApiEndpoints.driverRefresh &&
            options.path != ApiEndpoints.logout) {
          final session = SessionService();
          
          // Enhanced logging: JWT expiration check
          final sessionData = await session.getSession();
          final expiresAt = sessionData?['expiresAt'] as int?;
          if (expiresAt != null) {
            final expiryDateTime = DateTime.fromMillisecondsSinceEpoch(expiresAt);
            debugPrint('⏰ [ApiClient] Token expiration: $expiryDateTime (Expires in: ${expiryDateTime.difference(DateTime.now()).inMinutes} mins)');
          } else {
            debugPrint('⏰ [ApiClient] Token expiration: Unknown (No exp claim in JWT)');
          }

          final needsRefresh = await session.shouldRefreshToken();
          if (needsRefresh) {
            // Cooldown: don't hammer the refresh endpoint if we just tried
            final now = DateTime.now();
            if (_lastProactiveRefresh != null &&
                now.difference(_lastProactiveRefresh!) < _proactiveRefreshCooldown) {
              debugPrint('⏰ [ApiClient] Proactive refresh on cooldown, skipping');
            } else {
              _lastProactiveRefresh = now;
              debugPrint('⏰ [ApiClient] Silent proactive refresh triggered...');
              final result = await _refreshTokenOnce();
              final proactiveErrorCode = result?['errorCode'];

              if (proactiveErrorCode == 'INVALID_REFRESH') {
                final bool isOngoingRide = LocationService().activeRouteId != null;
                if (isOngoingRide) {
                  debugPrint('🛡️ Active ride — suppressing logout on proactive refresh error.');
                  return handler.next(options);
                }
                debugPrint('🔒 [ApiClient] Proactive refresh: INVALID_REFRESH — logging out');
                await _safeLogout();
                return handler.reject(
                  DioException(
                    requestOptions: options,
                    error: result?['error'] ?? 'Session expired',
                    type: DioExceptionType.badResponse,
                  ),
                );
              } else if (proactiveErrorCode == 'SERVER_ERROR') {
                // 500 REFRESH_FAILED — transient server issue, never logout
                debugPrint('⚠️ [ApiClient] Proactive refresh hit server error — proceeding with current token');
              }
            }
          }
        }

        // 2. Don't read SecureStorage directly - delegate to SessionService
        if (options.path != ApiEndpoints.driverRefresh &&
            options.path != ApiEndpoints.logout) {
          final sessionService = SessionService();
          final token = await sessionService.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
            debugPrint('🔑 Current token: $token');
          }

          // Inject custom routing headers
          final tenantId = await sessionService.getTenantId();
          if (tenantId != null && tenantId.isNotEmpty) {
            options.headers['X-Tenant-Id'] = tenantId;
            debugPrint('🏢 X-Tenant-Id header injected: $tenantId');
          }
          final driverId = await sessionService.getDriverId();
          if (driverId != null && driverId.isNotEmpty) {
            options.headers['X-Driver-Id'] = driverId;
            debugPrint('👤 X-Driver-Id header injected: $driverId');
          }
          final vendorId = await sessionService.getVendorId();
          if (vendorId != null && vendorId.isNotEmpty) {
            options.headers['X-Vendor-Id'] = vendorId;
            debugPrint('🏭 X-Vendor-Id header injected: $vendorId');
          }
        } else {
          debugPrint('🔑 Skipping Authorization and tenant headers for refresh request');
        }
        _logRequest(options);
        return handler.next(options);
      },

      // ── Response ───────────────────────────────────────────────────────────
      onResponse: (response, handler) {
        _logResponse(response);
        return handler.next(response);
      },

      // ── Error ──────────────────────────────────────────────────────────────
      onError: (DioException e, handler) async {
        final status = e.response?.statusCode;
        _logError(e);

        // 3. Retry Temporary Server Errors (502, 503, 504) — maximum 2 retries
        final bool isRetryableServer = status != null && (status == 502 || status == 503 || status == 504);
        if (isRetryableServer) {
          final serverRetryCount = (e.requestOptions.extra['serverRetryCount'] as int?) ?? 0;
          if (serverRetryCount < 2) {
            final delay = Duration(seconds: 2 * (serverRetryCount + 1));
            debugPrint('⚠️ Server error $status — retrying in ${delay.inSeconds} seconds (Attempt ${serverRetryCount + 1}/2)...');
            await Future.delayed(delay);
            final opts = e.requestOptions;
            opts.extra['serverRetryCount'] = serverRetryCount + 1;
            try {
              final retryResponse = await _dio.fetch(opts);
              return handler.resolve(retryResponse);
            } catch (retryErr) {
              debugPrint('❌ Retry after server error failed: $retryErr');
              if (retryErr is DioException) {
                return handler.next(retryErr);
              }
              return handler.next(e);
            }
          }
        }

        // ── Transient network errors — never treat as logout ─────────────────
        // SocketException, timeout, 502, 503, 504 etc. are network hiccups.
        // We pass them through without touching the session.
        final isNetworkError = e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout ||
            e.type == DioExceptionType.connectionError ||
            (status != null && (status == 502 || status == 503 || status == 504));

        if (isNetworkError) {
          debugPrint('🌐 Network error — keeping session intact');
          return handler.next(e);
        }

        // ── 401/403 handling ─────────────────────────────────────────────────
        if (status == 401 || status == 403) {
          final bool isOngoingRide = LocationService().activeRouteId != null;

          // Avoid infinite refresh loop: if the refresh endpoint itself 401s or 403s
          // (e.g. INVALID_TOKEN, TOKEN_EXPIRED, DEVICE_NOT_AUTHORIZED etc.)
          // Also skip for logout — we're already logging out, no point retrying.
          if (e.requestOptions.path == ApiEndpoints.driverRefresh) {
            debugPrint('🔒 Refresh endpoint returned $status — session is invalid.');
            if (isOngoingRide) {
              debugPrint('🛡️ Active ride — suppressing logout on refresh-endpoint $status.');
            } else {
              // Refresh token is truly invalid — only safe time to logout
              await _safeLogout();
            }
            return handler.next(e);
          }
          if (e.requestOptions.path == ApiEndpoints.logout) {
            debugPrint('🔒 Logout endpoint returned $status — ignoring, already logging out.');
            return handler.next(e);
          }

          // Prevent retry loop: allow each request only ONE retry
          final retryCount = (e.requestOptions.extra['retryCount'] as int?) ?? 0;
          if (retryCount >= 1) {
            debugPrint('⚠️ Already retried once (Attempt $retryCount) — not retrying again');
            return handler.next(e);
          }

          debugPrint('🔒 401/403 — attempting silent token refresh for retry...');
          final refreshResult = await _refreshTokenOnce();
          final newToken = refreshResult?['access_token'] as String?;

          if (newToken != null) {
            // Retry original request with new token
            final opts = e.requestOptions;
            opts.headers['Authorization'] = 'Bearer $newToken';
            opts.extra['retryCount'] = retryCount + 1;
            debugPrint('🔄 [ApiClient] Retrying original request to ${opts.uri} (Attempt ${opts.extra['retryCount']})...');
            try {
              final retryResponse = await _dio.fetch(opts);
              return handler.resolve(retryResponse);
            } catch (retryErr) {
              debugPrint('❌ Retry after refresh also failed: $retryErr');
              if (retryErr is DioException) {
                return handler.next(retryErr);
              }
              return handler.next(e);
            }
          }

          // Refresh failed — decide whether to logout based on error type
          final errorCode = refreshResult?['errorCode'];
          if (errorCode == 'NETWORK_ERROR' || errorCode == 'TIMEOUT') {
            debugPrint('🌐 Refresh failed due to network/timeout — keeping session intact');
            return handler.next(e);
          }
          if (errorCode == 'SERVER_ERROR') {
            // 500 REFRESH_FAILED per API docs — transient, never logout
            debugPrint('⚠️ Refresh hit server error (REFRESH_FAILED) — keeping session intact');
            return handler.next(e);
          }

          // INVALID_REFRESH — covers TOKEN_EXPIRED, INVALID_TOKEN, DRIVER_NOT_FOUND,
          // DEVICE_NOT_AUTHORIZED, DEVICE_CONFLICT — all are hard session failures.
          if (isOngoingRide) {
            final reason = refreshResult?['error'] ?? 'unknown';
            debugPrint('🛡️ Active ride — suppressing logout. Refresh reason: $reason');
          } else {
            await _safeLogout();
          }
        }

        return handler.next(e);
      },
    ));
  }

  // ── Refresh token wrapper ──────────────────────────────────────────────────
  // Calls the single-coordination refreshToken() in AuthService.
  Future<Map<String, dynamic>?> _refreshTokenOnce() async {
    try {
      debugPrint('🔄 [ApiClient] Initiating silent token refresh call...');
      final result = await AuthService().refreshToken();
      if (result['success'] == true) {
        debugPrint('✅ [ApiClient] Token refreshed successfully');
      } else {
        debugPrint('⚠️ [ApiClient] Refresh failed: ${result['error']}');
      }
      return result;
    } catch (e) {
      debugPrint('❌ Refresh exception: $e');
      String errorCode = 'UNKNOWN';
      if (e is DioException) {
        final isTimeout = e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout;
        final isNetwork = e.type == DioExceptionType.connectionError;
        final status = e.response?.statusCode;
        if (isTimeout) {
          errorCode = 'TIMEOUT';
        } else if (isNetwork) {
          errorCode = 'NETWORK_ERROR';
        } else if (status != null) {
          if (status == 400 || status == 401 || status == 403) {
            errorCode = 'INVALID_REFRESH';
          } else if (status >= 500) {
            errorCode = 'SERVER_ERROR';
          }
        }
      }
      return {'success': false, 'error': e.toString(), 'errorCode': errorCode};
    }
  }

  // ── Safe logout — only clears managed session keys, never deleteAll() ────
  // deleteAll() would wipe FCM tokens, device IDs, and any future secure keys.
  // We only ever clear what SessionService owns.
  Future<void> _safeLogout() async {
    // Cooldown guard: prevent repeated logout calls within 30 seconds
    final now = DateTime.now();
    if (_lastLogoutAttempt != null &&
        now.difference(_lastLogoutAttempt!).inSeconds < 30) {
      debugPrint('🔒 [ApiClient] Logout already triggered recently — skipping duplicate');
      return;
    }
    _lastLogoutAttempt = now;

    debugPrint('🔒 Session invalid — logging out safely');

    // Prefer full logout via AuthProvider (stops bg services + notifies UI)
    if (_logoutCallback != null) {
      try {
        await _logoutCallback!();
        return;
      } catch (e) {
        debugPrint('⚠️ [ApiClient] Full logout callback failed: $e — falling back to session clear');
      }
    }

    // Fallback: just clear session + navigate (no provider callback registered)
    await SessionService().clearSession();
    // Navigate to login — ApiClient delegates navigation via NavigationService
    // so the UI layer remains in control.
    NavigationService.navigateTo('/login');
  }

  // ── Logging Helpers ────────────────────────────────────────────────────────

  void _logRequest(RequestOptions options) {
    debugPrint('╔══ 🌐 HTTP REQUEST ══════════════════════════════════════════');
    debugPrint('║ Method: ${options.method.toUpperCase()}');
    debugPrint('║ URL: ${options.uri}');
    if (options.headers.isNotEmpty) {
      debugPrint('║ Headers:');
      options.headers.forEach((key, value) {
        if (key.toLowerCase() == 'authorization' && value is String && value.length > 20) {
          debugPrint('║   $key: Bearer ...${value.substring(value.length - 10)}');
        } else {
          debugPrint('║   $key: $value');
        }
      });
    }
    if (options.queryParameters.isNotEmpty) {
      debugPrint('║ Query Parameters: ${options.queryParameters}');
    }
    if (options.data != null) {
      debugPrint('║ Payload: ${options.data}');
    }
    debugPrint('╚═════════════════════════════════════════════════════════════');
  }

  void _logResponse(Response response) {
    debugPrint('╔══ ✅ HTTP RESPONSE ═════════════════════════════════════════');
    debugPrint('║ Status: ${response.statusCode} ${response.statusMessage ?? ""}');
    debugPrint('║ URL: ${response.requestOptions.uri}');
    if (response.headers.map.isNotEmpty) {
      debugPrint('║ Headers:');
      response.headers.map.forEach((key, value) {
        debugPrint('║   $key: $value');
      });
    }
    if (response.data != null) {
      debugPrint('║ Body: ${response.data}');
    }
    debugPrint('╚═════════════════════════════════════════════════════════════');
  }

  void _logError(DioException e) {
    final response = e.response;
    debugPrint('╔══ ❌ HTTP ERROR ════════════════════════════════════════════');
    debugPrint('║ Message: ${e.message}');
    debugPrint('║ Type: ${e.type}');
    debugPrint('║ URL: ${e.requestOptions.uri}');
    if (response != null) {
      debugPrint('║ Status: ${response.statusCode} ${response.statusMessage ?? ""}');
      if (response.headers.map.isNotEmpty) {
        debugPrint('║ Headers:');
        response.headers.map.forEach((key, value) {
          debugPrint('║   $key: $value');
        });
      }
      if (response.data != null) {
        debugPrint('║ Response Body: ${response.data}');
      }
    }
    debugPrint('╚═════════════════════════════════════════════════════════════');
  }

  Dio get client => _dio;
}
