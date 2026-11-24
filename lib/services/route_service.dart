import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../config/constants.dart';
import 'api_client.dart';
import '../models/driver_current_state.dart';

class RouteService {
  final Dio _dio = ApiClient().client;
  final Logger _logger = Logger();

  static const String _escortNotBoardedBackendMessage =
      'Escort must be boarded before picking up employees. Use POST /driver/escort/board first.';
  static const String _escortNotBoardedFriendlyMessage =
      'Please board the security escort first before picking up passengers.';

  // Singleton
  static final RouteService _instance = RouteService._internal();
  factory RouteService() => _instance;
  RouteService._internal();

  Future<Map<String, dynamic>> getCurrentState() async {
    try {
      final response = await _dio.get('/api/v1/driver/current-state');
      final body = response.data;
      final data = body is Map && body['data'] is Map ? body['data'] : body;
      if (data is! Map) {
        return {'success': false, 'error': 'Invalid current-state response'};
      }
      return {
        'success': true,
        'state': DriverCurrentState.fromJson(Map<String, dynamic>.from(data)),
      };
    } on DioException catch (e) {
      _logger.e('Failed to fetch current driver state', error: e);
      return _handleError(e);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Driver Trips
  Future<Map<String, dynamic>> getDriverTrips({
    String statusFilter = 'upcoming',
    String? bookingDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{'status_filter': statusFilter};

      if (bookingDate != null) {
        queryParams['booking_date'] = bookingDate;
      } else if (statusFilter == 'upcoming') {
        final now = DateTime.now();
        final formatted =
            "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
        queryParams['booking_date'] = formatted;
      }

      _logger.i('Fetching trips: $queryParams');

      final response = await _dio.get(
        ApiEndpoints.driverTrips,
        queryParameters: queryParams,
      );

      // RN: result.routes = res.data.data.routes
      final data = response.data['data'];
      final routes =
          (data is Map<String, dynamic> && data.containsKey('routes'))
          ? data['routes']
          : (data is List ? data : []); // Fallback if API changes

      return {'success': true, 'routes': routes is List ? routes : []};
    } on DioException catch (e) {
      _logger.e('Failed to fetch trips', error: e);
      return _handleError(e);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Fetch Employee Bookings (My Schedules for Employee/Driver)
  Future<Map<String, dynamic>> getEmployeeBookings({
    required Map<String, dynamic> params,
  }) async {
    try {
      _logger.i('Fetching bookings: $params');
      final response = await _dio.get(
        ApiEndpoints.bookings,
        queryParameters: params,
      );

      final data =
          response.data['data']; // Assuming standard response structure
      // RN app expects result.bookings
      return {
        'success': true,
        'bookings': data is List
            ? data
            : (data['bookings'] is List ? data['bookings'] : []),
      };
    } on DioException catch (e) {
      _logger.e('Failed to fetch bookings', error: e);
      return {'success': false, 'error': e.message};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Start Duty
  Future<Map<String, dynamic>> startDuty(String routeId) async {
    try {
      _logger.i('Starting duty for route: $routeId');
      // Fix: Use query params, not body
      final response = await _dio.post(
        ApiEndpoints.dutyStart,
        queryParameters: {'route_id': routeId},
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// End Duty
  Future<Map<String, dynamic>> endDuty(String routeId, String? reason) async {
    try {
      _logger.i('Ending duty for route: $routeId');

      final params = {'route_id': routeId};
      if (reason != null) params['reason'] = reason;

      // Fix: Use PUT and query params
      final response = await _dio.put(
        ApiEndpoints.dutyEnd,
        queryParameters: params,
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Start Pickup (Start Trip)
  /// [idempotencyKey] — stable client-generated key; safe to retry with the
  ///   same key on network timeout without creating a duplicate stop event.
  /// [deviceTimestamp] — device-local event time as ISO-8601 UTC string.
  Future<Map<String, dynamic>> startTrip({
    required String routeId,
    required String bookingId,
    String? otp,
    required double latitude,
    required double longitude,
    String? idempotencyKey,
    String? deviceTimestamp,
  }) async {
    try {
      _logger.i('Starting trip (Pickup) for booking: $bookingId');

      final params = <String, dynamic>{
        'route_id': routeId,
        'booking_id': bookingId,
        'current_latitude': latitude,
        'current_longitude': longitude,
      };
      if (otp != null) params['otp'] = otp;
      if (idempotencyKey != null) params['idempotency_key'] = idempotencyKey;
      if (deviceTimestamp != null) params['device_timestamp'] = deviceTimestamp;

      final response = await _dio.post(
        ApiEndpoints.tripStart,
        queryParameters: params,
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Drop Passenger (End Trip)
  /// [idempotencyKey] — stable client-generated key; safe to retry with the
  ///   same key on network timeout without creating a duplicate stop event.
  /// [deviceTimestamp] — device-local event time as ISO-8601 UTC string.
  Future<Map<String, dynamic>> dropTrip({
    required String routeId,
    required String bookingId,
    String? otp,
    required double latitude,
    required double longitude,
    String? idempotencyKey,
    String? deviceTimestamp,
  }) async {
    try {
      _logger.i('Dropping passenger for booking: $bookingId');

      final params = <String, dynamic>{
        'route_id': routeId,
        'booking_id': bookingId,
        'current_latitude': latitude,
        'current_longitude': longitude,
      };
      if (otp != null) params['otp'] = otp;
      if (idempotencyKey != null) params['idempotency_key'] = idempotencyKey;
      if (deviceTimestamp != null) params['device_timestamp'] = deviceTimestamp;

      final response = await _dio.put(
        ApiEndpoints.tripEnd,
        queryParameters: params,
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Mark No Show
  Future<Map<String, dynamic>> markNoShow({
    required String routeId,
    required String bookingId,
    String? reason,
  }) async {
    try {
      _logger.i('Marking No Show for booking: $bookingId');

      final params = {
        'route_id': routeId,
        'booking_id': bookingId,
        'reason': reason ?? 'Passenger did not show up',
      };

      // Fix: Use PUT and query params
      final response = await _dio.put(
        ApiEndpoints.noShow,
        queryParameters: params,
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Send a GPS location ping for an ONGOING route — POST /driver/location.
  /// Called every ~7 s while duty is active.
  /// [speedKmh] is optional but should be passed whenever the device GPS
  /// provides it; the server uses it for ETA recalc and speed enforcement.
  /// Throws on non-2xx so the caller can apply retry logic.
  Future<void> sendLocation({
    required String routeId,
    required double latitude,
    required double longitude,
    double? speedKmh,
  }) async {
    final params = <String, dynamic>{
      'route_id': routeId,
      'latitude': latitude,
      'longitude': longitude,
    };
    if (speedKmh != null) params['speed'] = speedKmh;
    await _dio.post(ApiEndpoints.driverLocation, queryParameters: params);
  }

  /// Board the escort — POST /driver/escort/board.
  /// [code] is omitted for `off` mode (board immediately) and required for
  /// `universal` / `unique` modes.
  Future<Map<String, dynamic>> escortBoard({
    required String routeId,
    String? code,
  }) async {
    try {
      _logger.i('Boarding escort for route: $routeId');
      final params = <String, dynamic>{'route_id': routeId};
      if (code != null) params['code'] = code;
      final response = await _dio.post(
        ApiEndpoints.escortBoard,
        queryParameters: params,
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Cancel Booking
  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    try {
      _logger.i('Cancelling booking: $bookingId');
      final response = await _dio.post(
        ApiEndpoints.cancelBooking,
        data: {'booking_id': bookingId},
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      return _handleError(e);
    }
  }

  /// Fetch Driver History Report
  Future<Map<String, dynamic>> getDriverHistoryReport({
    required String startDate,
    required String endDate,
  }) async {
    try {
      final queryParams = {'start_date': startDate, 'end_date': endDate};

      _logger.i('Fetching history report: $queryParams');
      final response = await _dio.get(
        ApiEndpoints.driverHistoryReport,
        queryParameters: queryParams,
      );

      final responseData = response.data;
      if (responseData is Map && responseData['success'] == true) {
        final data = responseData['data'] ?? {};
        return {
          'success': true,
          'summary': data['summary'] ?? {},
          'bookings': data['bookings'] ?? [],
        };
      }

      return {
        'success': false,
        'error':
            (responseData is Map ? responseData['message'] : null) ??
            'Failed to load report',
      };
    } on DioException catch (e) {
      _logger.e('Failed to fetch history report', error: e);
      return _handleError(e);
    } catch (e) {
      _logger.e('History report unexpected error', error: e);
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Download Driver History Report as Excel
  Future<Map<String, dynamic>> downloadDriverHistoryReport({
    required String startDate,
    required String endDate,
    required String savePath,
  }) async {
    try {
      final queryParams = {
        'start_date': startDate,
        'end_date': endDate,
        'format': 'excel',
      };

      _logger.i('Downloading history report to: $savePath');
      final response = await _dio.download(
        ApiEndpoints.driverHistoryReport,
        savePath,
        queryParameters: queryParams,
      );

      return {'success': true};
    } on DioException catch (e) {
      _logger.e('Failed to download history report', error: e);
      return _handleError(e);
    } catch (e) {
      _logger.e('History report download error', error: e);
      return {'success': false, 'error': e.toString()};
    }
  }

  Map<String, dynamic> _handleError(DioException e) {
    String error = 'Network error';
    String? errorCode;
    Map? backendDetails;

    final status = e.response?.statusCode;

    // Map status codes to fallback messages (used only when the backend sends
    // no body — e.g. pure network errors, timeouts, proxy errors).
    // When the backend DOES send a JSON body with a 'message' field, that
    // overrides these strings below.
    if (status == 401) {
      error = 'Session expired. Please log in again.';
      errorCode = 'UNAUTHORIZED';
    } else if (status == 403) {
      error = 'Access denied. Session may have expired.';
      errorCode = 'FORBIDDEN';
    } else if (status == 404) {
      error = 'Resource not found.';
      errorCode = 'NOT_FOUND';
    } else if (status == 409) {
      // Conflict — stop event already recorded for this booking.
      // The backend message (if present) will override 'error' below.
      error = 'A conflicting stop event already exists.';
      errorCode = 'STOP_EVENT_CONFLICT';
    } else if (status != null && status >= 500) {
      error = 'Server error. Please try again later.';
      errorCode = 'SERVER_ERROR';
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      error = 'Connection timed out. Please check your network.';
      errorCode = 'TIMEOUT';
    } else if (e.type == DioExceptionType.connectionError) {
      error = 'No internet connection.';
      errorCode = 'NETWORK_ERROR';
    }

    // Try to override with server's own message if available
    if (e.response?.data != null) {
      final data = e.response?.data;
      if (data is Map) {
        final detail = data['detail'];
        if (detail is List) {
          error = detail
              .map((item) => "${item['loc']?.last}: ${item['msg']}")
              .join(', ');
        } else if (detail is Map) {
          error = detail['message']?.toString() ?? error;
          errorCode =
              detail['error_code']?.toString() ??
              detail['code']?.toString() ??
              errorCode;
          if (detail['details'] is Map) {
            backendDetails = detail['details'] as Map;
          }
        } else if (detail is String && detail.isNotEmpty) {
          error = detail;
        } else {
          final msg = data['message'] ?? data['error'];
          if (msg is String && msg.isNotEmpty) error = msg;
        }
        errorCode =
            data['error_code']?.toString() ??
            data['code']?.toString() ??
            errorCode;
        if (data['details'] is Map) {
          backendDetails ??= data['details'] as Map;
        }
      }
    }

    final String originalBackendMessage = error;
    if (errorCode == 'ESCORT_NOT_BOARDED' ||
        originalBackendMessage == _escortNotBoardedBackendMessage) {
      _logger.w(
        'RouteService: ESCORT_NOT_BOARDED backend error '
        'message=$originalBackendMessage, errorCode=$errorCode, '
        'details=$backendDetails',
      );
      error = _escortNotBoardedFriendlyMessage;
    }

    _logger.w(
      'RouteService: HTTP $status ${e.requestOptions.method} '
      '${e.requestOptions.path} → errorCode=$errorCode, message=$error, '
      'details=$backendDetails',
    );

    return {'success': false, 'error': error, 'errorCode': errorCode};
  }
}
