import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/config/constants.dart';
import 'package:driver_app_flutter/providers/location_provider.dart';
import 'package:driver_app_flutter/services/api_client.dart';
import 'package:driver_app_flutter/services/route_service.dart';
import 'package:geolocator/geolocator.dart';

Position _position({
  required DateTime timestamp,
  required double latitude,
  required double longitude,
  required double accuracy,
}) {
  return Position(
    latitude: latitude,
    longitude: longitude,
    timestamp: timestamp,
    accuracy: accuracy,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
    isMocked: false,
  );
}

void main() {
  group('validateActionPosition', () {
    final now = DateTime.utc(2026, 11, 24, 6, 0, 0);

    test('accepts a fresh accurate position', () {
      final position = _position(
        timestamp: now.subtract(const Duration(seconds: 2)),
        latitude: 12.884416,
        longitude: 77.631538,
        accuracy: 5,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.none,
      );
    });

    test('rejects a stale cached position', () {
      final position = _position(
        timestamp: now.subtract(const Duration(minutes: 30)),
        latitude: 13.0893828,
        longitude: 77.5010419,
        accuracy: 5,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.stale,
      );
    });

    test('rejects a future timestamp', () {
      final position = _position(
        timestamp: now.add(const Duration(seconds: 30)),
        latitude: 12.884416,
        longitude: 77.631538,
        accuracy: 5,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.stale,
      );
    });

    test('rejects poor accuracy', () {
      final position = _position(
        timestamp: now,
        latitude: 12.884416,
        longitude: 77.631538,
        accuracy: 150,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.inaccurate,
      );
    });

    test('rejects invalid coordinates', () {
      final position = _position(
        timestamp: now,
        latitude: 100,
        longitude: 77.631538,
        accuracy: 5,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.unavailable,
      );
    });

    test('rejects missing accuracy', () {
      final position = _position(
        timestamp: now,
        latitude: 12.884416,
        longitude: 77.631538,
        accuracy: 0,
      );

      expect(
        validateActionPosition(position, now: now),
        ActionLocationIssue.unavailable,
      );
    });
  });

  test('startTrip sends geofence coordinates in lat/lng order', () async {
    final client = ApiClient().client;
    RequestOptions? capturedRequest;
    final interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == ApiEndpoints.tripStart) {
          capturedRequest = options;
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'success': true, 'message': 'Trip started'},
            ),
          );
        }
        return handler.next(options);
      },
    );
    client.interceptors.insert(0, interceptor);

    try {
      final result = await RouteService().startTrip(
        routeId: '4476',
        bookingId: '4303',
        otp: '1234',
        latitude: 12.884416,
        longitude: 77.631538,
      );

      expect(result['success'], isTrue);
      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.queryParameters['current_latitude'], 12.884416);
      expect(capturedRequest!.queryParameters['current_longitude'], 77.631538);
    } finally {
      client.interceptors.remove(interceptor);
    }
  });
}
