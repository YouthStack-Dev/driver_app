import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:driver_app_flutter/services/speed_violation_service.dart';
import 'package:driver_app_flutter/services/api_client.dart';

void main() {
  test('SpeedViolationService reportViolation payload test', () async {
    final client = ApiClient().client;
    
    // Add a mock interceptor to capture the outgoing request
    RequestOptions? capturedRequest;
    final testInterceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/api/v1/speed-violations/')) {
          capturedRequest = options;
          // Return a mock response to prevent actual HTTP call
          return handler.resolve(Response(
            requestOptions: options,
            statusCode: 200,
            data: {'status': 'success'},
          ));
        }
        return handler.next(options);
      },
    );
    client.interceptors.insert(0, testInterceptor);

    try {
      final service = SpeedViolationService();
      service.resetCooldown(); // Ensure cooldown is not active
      
      await service.reportViolation(
        routeId: '15',
        vehicleId: 25,
        speedKmph: 95.5,
        speedLimitKmph: 60.0,
        latitude: 19.0760,
        longitude: 72.8777,
      );

      expect(capturedRequest, isNotNull);
      final payload = capturedRequest!.data as Map<String, dynamic>;
      
      // Verify values and types match the spec exactly
      expect(payload['route_id'], equals(15));
      expect(payload['vehicle_id'], equals(25));
      expect(payload['speed_recorded'], equals(95.5));
      expect(payload['latitude'], equals(19.0760));
      expect(payload['longitude'], equals(72.8777));
      expect(payload['recorded_at'], isNotNull);
      
      // Ensure speed_limit_kmph is not in the payload
      expect(payload.containsKey('speed_limit_kmph'), isFalse);
    } finally {
      client.interceptors.remove(testInterceptor);
    }
  });
}
