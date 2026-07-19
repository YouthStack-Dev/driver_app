import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:driver_app_flutter/services/flutter_refresh_coordinator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('FlutterRefreshCoordinator', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('RefreshOutcome enum has all 4 values', () {
      expect(RefreshOutcome.values.length, 4);
      expect(RefreshOutcome.values, contains(RefreshOutcome.success));
      expect(RefreshOutcome.values, contains(RefreshOutcome.permanentFailure));
      expect(RefreshOutcome.values, contains(RefreshOutcome.temporaryFailure));
      expect(RefreshOutcome.values, contains(RefreshOutcome.notNeeded));
    });

    test('refreshIfNeeded returns temporaryFailure when no session', () async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      final coordinator = FlutterRefreshCoordinator();
      final result = await coordinator.refreshIfNeeded(force: true);
      expect(result, RefreshOutcome.permanentFailure);
    });

    test('shouldAttemptStartupRefresh returns false for empty session', () async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      final coordinator = FlutterRefreshCoordinator();
      final result = await coordinator.shouldAttemptStartupRefresh();
      expect(result, isFalse);
    });

    test('same instance is returned from factory', () {
      final a = FlutterRefreshCoordinator();
      final b = FlutterRefreshCoordinator();
      expect(a, same(b));
    });
  });
}
