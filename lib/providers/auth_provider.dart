import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/session_service.dart';
import '../services/location_service.dart';
import '../services/device_service.dart';
import '../services/driver_config_service.dart';
import '../services/push_notification_service.dart';
import '../services/background_tracking_service.dart';
import '../services/api_client.dart';
import '../services/native_auth_bridge.dart';
import '../services/flutter_refresh_coordinator.dart';

enum AuthStatus {
  unknown,
  restoring,
  authenticated,
  offlineAuthenticated,
  tempAuthenticated,
  authenticationError,
  unauthenticated,
}

class AuthProvider extends ChangeNotifier {
  final AuthService    _authService    = AuthService();
  final SessionService _sessionService = SessionService();
  final DeviceService  _deviceService  = DeviceService();
  final NativeAuthBridge _nativeAuth  = NativeAuthBridge();
  final FlutterRefreshCoordinator _refreshCoord = FlutterRefreshCoordinator();

  AuthStatus _status = AuthStatus.unknown;
  AuthStatus get status => _status;

  Map<String, dynamic>? _currentUser;
  Map<String, dynamic>? get currentUser => _currentUser;

  List<dynamic> _accounts = [];
  Map<String, dynamic>? _driver;
  List<dynamic> get vendors  => _accounts;
  List<dynamic> get accounts => _accounts;
  Map<String, dynamic>? get driver => _driver;

  String? _startupError;
  String? get startupError => _startupError;

  String get tenantId {
    if (_currentUser == null) return 'N/A';
    final val = _currentUser!['tenant_id'] ??
                _currentUser!['account']?['tenant_id'] ??
                _currentUser!['user']?['tenant_id'] ??
                _currentUser!['user']?['driver']?['tenant_id'] ??
                _currentUser!['user']?['tenant']?['tenant_id'];
    return val?.toString() ?? 'N/A';
  }

  String get vendorId {
    if (_currentUser == null) return 'N/A';
    final val = _currentUser!['vendor_id'] ??
                _currentUser!['account']?['vendor_id'] ??
                _currentUser!['user']?['driver']?['vendor_id'];
    return val?.toString() ?? 'N/A';
  }

  Future<void> init() async {
    _status = AuthStatus.restoring;
    ApiClient().setLogoutCallback(logout);

    // Step 1: Import native tokens if they exist and are newer
    await _importNativeTokensIfNewer();

    // Step 2: Validate session integrity
    final hasValid = await _sessionService.hasValidSession();
    if (!hasValid) {
      await _resolveUnauthenticated();
      notifyListeners();
      return;
    }

    final session = await _sessionService.getSession();
    if (session == null) {
      await _resolveUnauthenticated();
      notifyListeners();
      return;
    }

    _currentUser = session['user_data'];
    if (_currentUser != null) {
      _accounts = _currentUser!['accounts'] is List
          ? List.from(_currentUser!['accounts'])
          : [];
      _driver = _currentUser!['driver'] ?? _currentUser!['user']?['driver'];
    }

    // Step 3: Import native tokens again (may have been refreshed by Kotlin)
    final nativeTokenSet = await _sessionService.getNativeTokens();
    if (nativeTokenSet != null) {
      final nativeAccessToken = nativeTokenSet['access_token'] as String?;
      final nativeVersion = nativeTokenSet['token_version'] as int? ?? 0;
      if (nativeAccessToken != null && nativeAccessToken.isNotEmpty && nativeVersion > 0) {
        final flutterVersion = session['token_version'] as int? ?? 0;
        if (nativeVersion > flutterVersion) {
          debugPrint('[AuthProvider] Native has newer tokens — importing');
          await _sessionService.importNativeTokenSet(nativeTokenSet);
          _currentUser = (await _sessionService.getSession())?['user_data'] ?? _currentUser;
        }
      }
    }

    // Step 4: Attempt startup refresh
    final needsRefresh = await _sessionService.shouldRefreshToken(thresholdMinutes: 10);
    if (needsRefresh) {
      final refreshOutcome = await _refreshCoord.refreshIfNeeded(force: true);
      switch (refreshOutcome) {
        case RefreshOutcome.success:
          _status = AuthStatus.authenticated;
        case RefreshOutcome.notNeeded:
          _status = AuthStatus.authenticated;
        case RefreshOutcome.temporaryFailure:
          _status = AuthStatus.offlineAuthenticated;
          _startupError = 'Could not refresh token — offline mode';
        case RefreshOutcome.permanentFailure:
          final isOngoingRide = LocationService().activeRouteId != null;
          if (isOngoingRide) {
            _status = AuthStatus.offlineAuthenticated;
            _startupError = 'Session may expire soon';
          } else {
            await logout();
            return;
          }
      }
    } else {
      _status = AuthStatus.authenticated;
    }

    // Step 5: Start location tracking
    if (!LocationService().isTracking) {
      LocationService().startTracking();
    }

    // Step 6: Fire-and-forget background tasks
    unawaited(DriverConfigService().fetchConfig());
    unawaited(PushNotificationService().registerWithBackend());

    notifyListeners();
  }

  Future<void> _importNativeTokensIfNewer() async {
    try {
      final nativeTokenSet = await _nativeAuth.importNativeTokens();
      if (nativeTokenSet == null) return;

      final nativeVersion = nativeTokenSet['token_version'] as int? ?? 0;
      if (nativeVersion <= 0) return;

      final session = await _sessionService.getSession();
      final flutterVersion = session?['token_version'] as int? ?? 0;

      if (nativeVersion > flutterVersion) {
        debugPrint('[AuthProvider] Importing newer native tokens (v$nativeVersion > v$flutterVersion)');
        await _sessionService.importNativeTokenSet(nativeTokenSet);
      }
    } catch (e) {
      debugPrint('[AuthProvider] Native token import error: $e');
    }
  }

  Future<void> handleAppResume() async {
    if (_status == AuthStatus.unauthenticated || _status == AuthStatus.authenticationError) return;

    debugPrint('[AuthProvider] App resumed — checking session');

    // Step 1: Import any newer tokens from native
    await _importNativeTokensIfNewer();

    // Step 2: Check if native requires login
    final requiresLogin = await _nativeAuth.isRequiresLogin();
    if (requiresLogin) {
      final isOngoingRide = LocationService().activeRouteId != null;
      if (!isOngoingRide) {
        debugPrint('[AuthProvider] Native requires login — logging out');
        await logout();
        return;
      }
    }

    // Step 3: Refresh if needed
    try {
      final needsRefresh = await _sessionService.shouldRefreshToken(thresholdMinutes: 60);
      if (!needsRefresh) {
        _status = AuthStatus.authenticated;
        notifyListeners();
        return;
      }

      debugPrint('[AuthProvider] Refreshing on resume...');
      final result = await _refreshCoord.refreshIfNeeded(force: true);

      switch (result) {
        case RefreshOutcome.success:
          _status = AuthStatus.authenticated;
          await BackgroundTrackingService().syncSession();
        case RefreshOutcome.notNeeded:
          _status = AuthStatus.authenticated;
        case RefreshOutcome.temporaryFailure:
          _status = AuthStatus.offlineAuthenticated;
        case RefreshOutcome.permanentFailure:
          final isOngoingRide = LocationService().activeRouteId != null;
          if (!isOngoingRide) {
            await logout();
            return;
          }
          _status = AuthStatus.offlineAuthenticated;
      }

      notifyListeners();
    } catch (e) {
      debugPrint('[AuthProvider] Resume refresh exception: $e');
      _status = AuthStatus.offlineAuthenticated;
      notifyListeners();
    }
  }

  Future<void> _resolveUnauthenticated() async {
    final tempSession = await _sessionService.getTempSession();
    if (tempSession != null) {
      _accounts  = tempSession['accounts'] ?? [];
      _driver    = tempSession['driver'];
      _status    = AuthStatus.tempAuthenticated;
    } else {
      _status = AuthStatus.unauthenticated;
    }
  }

  Future<Map<String, dynamic>> verifyDevice(String license) async {
    debugPrint('[AuthProvider] verifyDevice() for license: "$license"');
    final deviceData = await _deviceService.getDeviceData();
    final cleanDl = license.trim().toUpperCase();
    final result = await _authService.verifyDevice(
        dlNumber: cleanDl, deviceData: deviceData);

    if (result['success'] == true) {
      _accounts = result['vendors'] ?? [];
      _driver   = {'license_number': cleanDl};
      _status   = AuthStatus.tempAuthenticated;
      await _sessionService.setTempSession(
        tempToken: 'verify_stage',
        accounts:  _accounts,
        driver:    _driver,
      );
      if (_accounts.length != 1) {
        notifyListeners();
      }
    }
    return result;
  }

  Future<Map<String, dynamic>> selectTenant(dynamic vendor, String license) async {
    final deviceData = await _deviceService.getDeviceData();
    final vId = vendor['vendor_id']?.toString();
    final tId = vendor['tenant_id']?.toString();

    if (vId == null || tId == null) {
      return {'success': false, 'error': 'Invalid vendor data'};
    }

    final result = await _authService.selectTenant(
      dlNumber:   license,
      deviceData: deviceData,
      vendorId:   vId,
      tenantId:   tId,
    );

    if (result['success'] == true) {
      _currentUser = result['user_data'];

      final userData = result['user_data'];
      _driver = userData?['driver'] ??
                userData?['user']?['driver'] ??
                _driver;

      final token = result['access_token'];

      final prefs = await SharedPreferences.getInstance();
      if (token    != null) await prefs.setString('token', token);
      if (userData != null) await prefs.setString('user_data', json.encode(userData));
      if (userData != null) {
        if (userData['driver_id'] != null) await prefs.setString('driver_id', userData['driver_id'].toString());
        if (userData['tenant_id'] != null) await prefs.setString('tenant_id', userData['tenant_id'].toString());
        if (userData['vendor_id'] != null) await prefs.setString('vendor_id', userData['vendor_id'].toString());
      }

      _status = AuthStatus.authenticated;

      await LocationService().stopTracking();
      LocationService().startTracking();

      unawaited(DriverConfigService().fetchConfig());
      unawaited(PushNotificationService().registerWithBackend());

      notifyListeners();
    }
    return result;
  }

  Future<Map<String, dynamic>> switchCompany(dynamic account) async {
    final session  = await _sessionService.getSession();
    final userData = session?['user_data'];
    final dlNumber = userData?['driver']?['license_number'] ?? userData?['license_number'];

    if (dlNumber == null) return {'success': false, 'error': 'Driver license not found'};

    final vId = account['vendor_id']?.toString() ?? account['vendor']?['id']?.toString();
    final tId = account['tenant_id']?.toString() ?? account['tenant']?['id']?.toString();

    if (vId == null || tId == null) return {'success': false, 'error': 'Invalid account data'};

    final deviceData = await _deviceService.getDeviceData();

    try {
      final result = await _authService.selectTenant(
        dlNumber:   dlNumber,
        deviceData: deviceData,
        vendorId:   vId,
        tenantId:   tId,
      );

      if (result['success'] == true) {
        await init();
        return result;
      }
      return result;
    } catch (e, stack) {
      debugPrint('[AuthProvider] switchCompany error: $e\n$stack');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> refreshToken() async {
    final result = await _authService.refreshToken();
    if (result['success'] == true) {
      await init();
    }
    return result;
  }

  Future<void> logout() async {
    debugPrint('[AuthProvider] Driver initiated logout');

    // Prevent refresh from writing tokens after logout
    await _nativeAuth.setAuthState('REQUIRES_LOGIN');

    try {
      await _authService.logout();
    } catch (e) {
      debugPrint('[AuthProvider] Backend logout API call failed: $e');
    }

    await BackgroundTrackingService().stopBackgroundTracking();
    await LocationService().stopTracking();
    await _sessionService.clearSession();
    await _sessionService.clearTempSession();

    _currentUser = null;
    _status      = AuthStatus.unauthenticated;

    notifyListeners();
  }
}
