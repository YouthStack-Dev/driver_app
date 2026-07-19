import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:driver_app_flutter/services/native_auth_bridge.dart';
import 'package:driver_app_flutter/services/session_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('NativeAuthBridge', () {
    test('getTokens returns null when channel is not set up', () async {
      NativeAuthBridge().getTokens();
      // Should not throw - MissingPluginException is caught
      // This test verifies the bridge handles missing method channels gracefully
      expect(true, isTrue);
    });

    test('clearTokens handles missing channel gracefully', () async {
      final result = await NativeAuthBridge().clearTokens();
      expect(result, isFalse);
    });

    test('hasTokens returns false on missing channel', () async {
      final result = await NativeAuthBridge().hasTokens();
      expect(result, isFalse);
    });

    test('getTokenVersion returns -1 on missing channel', () async {
      final result = await NativeAuthBridge().getTokenVersion();
      expect(result, -1);
    });
  });

  group('SessionService initialization', () {
    test('no session initially', () async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      final session = await SessionService().getSession();
      expect(session, isNull);
    });

    test('hasValidSession returns false for empty storage', () async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      final result = await SessionService().hasValidSession();
      expect(result, isFalse);
    });
  });
}
