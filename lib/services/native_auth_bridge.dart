import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class NativeAuthBridge {
  static const _authChannel = MethodChannel('mlt_driver/auth');

  static final NativeAuthBridge _instance = NativeAuthBridge._internal();
  factory NativeAuthBridge() => _instance;
  NativeAuthBridge._internal();

  Future<Map<String, dynamic>?> getTokens() async {
    try {
      final result = await _authChannel.invokeMethod<Map<dynamic, dynamic>>('getTokens');
      if (result == null) return null;
      return result.cast<String, dynamic>();
    } on MissingPluginException {
      debugPrint('[NativeAuthBridge] getTokens not available on this platform');
      return null;
    } catch (e) {
      debugPrint('[NativeAuthBridge] getTokens error: $e');
      return null;
    }
  }

  Future<bool> saveTokens(Map<String, dynamic> tokens) async {
    try {
      await _authChannel.invokeMethod('saveTokens', tokens);
      return true;
    } on MissingPluginException {
      debugPrint('[NativeAuthBridge] saveTokens not available on this platform');
      return false;
    } catch (e) {
      debugPrint('[NativeAuthBridge] saveTokens error: $e');
      return false;
    }
  }

  Future<bool> clearTokens() async {
    try {
      await _authChannel.invokeMethod('clearTokens');
      return true;
    } on MissingPluginException {
      debugPrint('[NativeAuthBridge] clearTokens not available on this platform');
      return false;
    } catch (e) {
      debugPrint('[NativeAuthBridge] clearTokens error: $e');
      return false;
    }
  }

  Future<int> getTokenVersion() async {
    try {
      final result = await _authChannel.invokeMethod<int>('getTokenVersion');
      return result ?? -1;
    } on MissingPluginException {
      return -1;
    } catch (e) {
      return -1;
    }
  }

  Future<String?> getAuthState() async {
    try {
      return await _authChannel.invokeMethod<String>('getAuthState');
    } on MissingPluginException {
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> setAuthState(String state) async {
    try {
      await _authChannel.invokeMethod('setAuthState', {'state': state});
      return true;
    } on MissingPluginException {
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> hasTokens() async {
    try {
      final result = await _authChannel.invokeMethod<bool>('hasTokens');
      return result ?? false;
    } on MissingPluginException {
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> setDriverMetadata({
    String? driverId,
    String? tenantId,
    String? deviceId,
  }) async {
    try {
      final args = <String, String?>{};
      if (driverId != null) args['driver_id'] = driverId;
      if (tenantId != null) args['tenant_id'] = tenantId;
      if (deviceId != null) args['device_id'] = deviceId;
      await _authChannel.invokeMethod('setDriverMetadata', args);
      return true;
    } on MissingPluginException {
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> importNativeTokens() async {
    final nativeTokens = await getTokens();
    if (nativeTokens == null) return null;

    final accessToken = nativeTokens['access_token'] as String?;
    if (accessToken == null || accessToken.isEmpty) return null;

    final tokenVersion = nativeTokens['token_version'] as int? ?? -1;
    final lastUpdateTime = nativeTokens['last_update_time'] as int? ?? 0;
    final authState = nativeTokens['authentication_state'] as String?;

    return {
      'access_token': accessToken,
      'refresh_token': nativeTokens['refresh_token'] as String?,
      'access_token_expires_at': nativeTokens['access_token_expires_at'] as int?,
      'refresh_token_expires_at': nativeTokens['refresh_token_expires_at'] as int?,
      'driver_id': nativeTokens['driver_id'] as String?,
      'tenant_id': nativeTokens['tenant_id'] as String?,
      'token_version': tokenVersion,
      'last_update_time': lastUpdateTime,
      'authentication_state': authState,
    };
  }

  Future<bool> isRequiresLogin() async {
    final state = await getAuthState();
    return state == 'REQUIRES_LOGIN';
  }
}
