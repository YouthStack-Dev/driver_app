import 'dart:async';
import 'package:flutter/foundation.dart';
import 'auth_service.dart';
import 'session_service.dart';
import 'background_tracking_service.dart';
import 'native_auth_bridge.dart';
import 'location_service.dart';

enum RefreshOutcome {
  success,
  permanentFailure,
  temporaryFailure,
  notNeeded,
}

class FlutterRefreshCoordinator {
  static final FlutterRefreshCoordinator _instance = FlutterRefreshCoordinator._internal();
  factory FlutterRefreshCoordinator() => _instance;
  FlutterRefreshCoordinator._internal();

  final SessionService _sessionService = SessionService();
  final NativeAuthBridge _nativeAuth = NativeAuthBridge();

  Completer<RefreshOutcome>? _ongoingRefresh;
  DateTime? _lastRefreshAttempt;
  static const _refreshCooldown = Duration(seconds: 10);

  Future<RefreshOutcome> refreshIfNeeded({bool force = false}) async {
    if (_ongoingRefresh != null) {
      debugPrint('[FlutterRefreshCoordinator] Refresh already in progress — awaiting');
      return _ongoingRefresh!.future;
    }

    if (!force && _lastRefreshAttempt != null &&
        DateTime.now().difference(_lastRefreshAttempt!) < _refreshCooldown) {
      debugPrint('[FlutterRefreshCoordinator] Refresh on cooldown');
      return RefreshOutcome.notNeeded;
    }

    final completer = Completer<RefreshOutcome>();
    _ongoingRefresh = completer;

    try {
      final result = await _performRefresh();
      completer.complete(result);
      return result;
    } finally {
      _ongoingRefresh = null;
      _lastRefreshAttempt = DateTime.now();
    }
  }

  Future<RefreshOutcome> _performRefresh() async {
    try {
      final session = await _sessionService.getSession();
      final refreshToken = session?['refresh_token'] as String?;
      if (refreshToken == null) {
        debugPrint('[FlutterRefreshCoordinator] No refresh token');

        final nativeTokens = await _nativeAuth.importNativeTokens();
        if (nativeTokens != null) {
          final nativeRefreshToken = nativeTokens['refresh_token'] as String?;
          if (nativeRefreshToken != null) {
            debugPrint('[FlutterRefreshCoordinator] Found native refresh token — importing and retrying');
            await _sessionService.importNativeTokenSet(nativeTokens);
            return _performRefresh();
          }
        }

        return RefreshOutcome.permanentFailure;
      }

      final authService = AuthService();
      final result = await authService.refreshToken();

      if (result['success'] == true) {
        await _sessionService.syncBackgroundSessionFromCurrent();

        await BackgroundTrackingService().syncSession();

        debugPrint('[FlutterRefreshCoordinator] Refresh succeeded');
        return RefreshOutcome.success;
      }

      final errorCode = result['errorCode'] as String? ?? 'UNKNOWN';
      debugPrint('[FlutterRefreshCoordinator] Refresh failed: $errorCode');

      if (errorCode == 'INVALID_REFRESH') {
        final nativeTokens = await _nativeAuth.importNativeTokens();
        if (nativeTokens != null) {
          final nativeRefreshToken = nativeTokens['refresh_token'] as String?;
          if (nativeRefreshToken != null && nativeRefreshToken != session?['refresh_token']) {
            debugPrint('[FlutterRefreshCoordinator] Native has different refresh token — importing and retrying');
            await _sessionService.importNativeTokenSet(nativeTokens);
            return _performRefresh();
          }
        }
        return RefreshOutcome.permanentFailure;
      }

      if (errorCode == 'NETWORK_ERROR' || errorCode == 'TIMEOUT') {
        return RefreshOutcome.temporaryFailure;
      }

      if (errorCode == 'SERVER_ERROR') {
        return RefreshOutcome.temporaryFailure;
      }

      return RefreshOutcome.temporaryFailure;
    } catch (e) {
      debugPrint('[FlutterRefreshCoordinator] Refresh exception: $e');
      return RefreshOutcome.temporaryFailure;
    }
  }

  Future<RefreshOutcome> refreshForFailedToken(String usedToken) async {
    final currentSession = await _sessionService.getSession();
    final currentToken = currentSession?['access_token'] as String?;

    if (currentToken != null && currentToken != usedToken && currentToken.isNotEmpty) {
      debugPrint('[FlutterRefreshCoordinator] Token already refreshed externally');
      return RefreshOutcome.notNeeded;
    }

    return refreshIfNeeded(force: true);
  }

  Future<bool> shouldAttemptStartupRefresh() async {
    final hasValid = await _sessionService.hasValidSession();
    if (!hasValid) return false;

    final needsRefresh = await _sessionService.shouldRefreshToken(thresholdMinutes: 5);
    if (!needsRefresh) return false;

    final nativeTokens = await _nativeAuth.importNativeTokens();
    if (nativeTokens != null) {
      final nativeAccessToken = nativeTokens['access_token'] as String?;
      final nativeVersion = nativeTokens['token_version'] as int? ?? 0;
      if (nativeAccessToken != null && nativeAccessToken.isNotEmpty && nativeVersion > 0) {
        final session = await _sessionService.getSession();
        final flutterVersion = session?['token_version'] as int? ?? 0;
        if (nativeVersion > flutterVersion) {
          debugPrint('[FlutterRefreshCoordinator] Native has newer tokens — importing');
          await _sessionService.importNativeTokenSet(nativeTokens);
          return false;
        }
      }
    }

    return true;
  }

  Future<bool> handleOngoingRideRefresh() async {
    final isOngoingRide = LocationService().activeRouteId != null;
    if (!isOngoingRide) return true;

    final result = await refreshIfNeeded(force: true);
    return result == RefreshOutcome.success || result == RefreshOutcome.notNeeded;
  }
}
