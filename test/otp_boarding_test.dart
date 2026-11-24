import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/config/constants.dart';
import 'package:driver_app_flutter/services/api_client.dart';
import 'package:driver_app_flutter/services/route_service.dart';

void main() {
  test('startTrip maps inactive-duty response to ROUTE_NOT_ONGOING', () async {
    final client = ApiClient().client;
    RequestOptions? capturedRequest;
    final interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == ApiEndpoints.tripStart) {
          capturedRequest = options;
          return handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.badResponse,
              response: Response(
                requestOptions: options,
                statusCode: 400,
                data: {
                  'detail': {
                    'success': false,
                    'message':
                        'Route must be in ONGOING state. Please start duty first.',
                    'error_code': 'ROUTE_NOT_ONGOING',
                  },
                },
              ),
            ),
          );
        }
        return handler.next(options);
      },
    );
    client.interceptors.insert(0, interceptor);

    try {
      final result = await RouteService().startTrip(
        routeId: '4461',
        bookingId: '9001',
        otp: '1234',
        latitude: 12.985555,
        longitude: 77.748368,
      );

      expect(result['success'], isFalse);
      expect(result['errorCode'], equals('ROUTE_NOT_ONGOING'));
      expect(
        result['error'],
        equals('Route must be in ONGOING state. Please start duty first.'),
      );
      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.queryParameters['route_id'], equals('4461'));
      expect(capturedRequest!.queryParameters['booking_id'], equals('9001'));
      expect(capturedRequest!.queryParameters['otp'], equals('1234'));
    } finally {
      client.interceptors.remove(interceptor);
    }
  });

  test('startTrip still returns success for a valid OTP boarding', () async {
    final client = ApiClient().client;
    final interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == ApiEndpoints.tripStart) {
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
        routeId: '4461',
        bookingId: '9001',
        otp: '1234',
        latitude: 12.985555,
        longitude: 77.748368,
      );

      expect(result['success'], isTrue);
      expect(result['data']['success'], isTrue);
    } finally {
      client.interceptors.remove(interceptor);
    }
  });
}
