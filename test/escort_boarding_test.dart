import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/config/constants.dart';
import 'package:driver_app_flutter/services/api_client.dart';
import 'package:driver_app_flutter/services/route_service.dart';

void main() {
  test(
    'escortBoard sends route_id as a query parameter without a code',
    () async {
      final client = ApiClient().client;
      RequestOptions? capturedRequest;
      final interceptor = InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == ApiEndpoints.escortBoard) {
            capturedRequest = options;
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'message': 'Escort boarded successfully.',
                  'data': {'escort_boarded': true},
                },
              ),
            );
          }
          return handler.next(options);
        },
      );
      client.interceptors.insert(0, interceptor);

      try {
        final result = await RouteService().escortBoard(routeId: '4424');

        expect(result['success'], isTrue);
        expect(capturedRequest, isNotNull);
        expect(capturedRequest!.method, equals('POST'));
        expect(capturedRequest!.queryParameters['route_id'], equals('4424'));
        expect(capturedRequest!.queryParameters.containsKey('code'), isFalse);
      } finally {
        client.interceptors.remove(interceptor);
      }
    },
  );

  test(
    'escortBoard surfaces nested backend error_code and validation message',
    () async {
      final client = ApiClient().client;
      final interceptor = InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == ApiEndpoints.escortBoard) {
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
                      'message': 'Escort boarding code is required',
                      'error_code': 'CODE_REQUIRED',
                      'details': {'route_id': 4424},
                      'timestamp': '2026-11-22 10:00:00',
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
        final result = await RouteService().escortBoard(routeId: '4424');

        expect(result['success'], isFalse);
        expect(result['error'], equals('Escort boarding code is required'));
        expect(result['errorCode'], equals('CODE_REQUIRED'));
      } finally {
        client.interceptors.remove(interceptor);
      }
    },
  );
}
