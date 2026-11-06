class DriverCurrentState {
  final String dutyStatus;
  final String? phase;
  final CurrentStateRoute? route;
  final CurrentStateStop? currentStop;
  final CurrentStateStop? nextStop;
  final List<OnboardEmployee> employeesOnboard;
  final DriverLocation? driverLocation;
  final ArrivalProximity? arrivalProximity;

  const DriverCurrentState({
    required this.dutyStatus,
    this.phase,
    this.route,
    this.currentStop,
    this.nextStop,
    this.employeesOnboard = const [],
    this.driverLocation,
    this.arrivalProximity,
  });

  factory DriverCurrentState.fromJson(Map<String, dynamic> json) {
    final rawEmployees = json['employees_onboard'];
    return DriverCurrentState(
      dutyStatus: json['duty_status']?.toString() ?? 'NOT_ON_DUTY',
      phase: json['phase']?.toString(),
      route: _asMap(json['route']) == null
          ? null
          : CurrentStateRoute.fromJson(_asMap(json['route'])!),
      currentStop: _asMap(json['current_stop']) == null
          ? null
          : CurrentStateStop.fromJson(_asMap(json['current_stop'])!),
      nextStop: _asMap(json['next_stop']) == null
          ? null
          : CurrentStateStop.fromJson(_asMap(json['next_stop'])!),
      employeesOnboard: rawEmployees is List
          ? rawEmployees
                .whereType<Map>()
                .map(
                  (item) =>
                      OnboardEmployee.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList()
          : const [],
      driverLocation: _asMap(json['driver_location']) == null
          ? null
          : DriverLocation.fromJson(_asMap(json['driver_location'])!),
      arrivalProximity: _asMap(json['arrival_proximity']) == null
          ? null
          : ArrivalProximity.fromJson(_asMap(json['arrival_proximity'])!),
    );
  }
}

class CurrentStateRoute {
  final int? routeId;
  final String? routeCode;
  final int? shiftId;
  final String? shiftTime;
  final String? logType;
  final String? status;
  final int? totalStops;
  final int? completedStops;

  const CurrentStateRoute({
    this.routeId,
    this.routeCode,
    this.shiftId,
    this.shiftTime,
    this.logType,
    this.status,
    this.totalStops,
    this.completedStops,
  });

  factory CurrentStateRoute.fromJson(Map<String, dynamic> json) =>
      CurrentStateRoute(
        routeId: _asInt(json['route_id']),
        routeCode: json['route_code']?.toString(),
        shiftId: _asInt(json['shift_id']),
        shiftTime: json['shift_time']?.toString(),
        logType: json['log_type']?.toString(),
        status: json['status']?.toString(),
        totalStops: _asInt(json['total_stops']),
        completedStops: _asInt(json['completed_stops']),
      );
}

class CurrentStateStop {
  final int? bookingId;
  final int? stopOrder;
  final int? employeeId;
  final String? employeeName;
  final String? employeePhone;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final String? pickupLocation;
  final double? dropLatitude;
  final double? dropLongitude;
  final String? dropLocation;
  final String? bookingStatus;
  final String? estimatedArrivalTime;
  final String? plannedArrivalAt;
  final String? plannedPickupTime;
  final String? estimatedDropTime;
  final String? currentPickupEtaAt;
  final String? currentDropEtaAt;
  final String? etaStatus;
  final String? etaSource;
  final bool boardingOtpRequired;
  final bool deboardingOtpRequired;

  const CurrentStateStop({
    this.bookingId,
    this.stopOrder,
    this.employeeId,
    this.employeeName,
    this.employeePhone,
    this.pickupLatitude,
    this.pickupLongitude,
    this.pickupLocation,
    this.dropLatitude,
    this.dropLongitude,
    this.dropLocation,
    this.bookingStatus,
    this.estimatedArrivalTime,
    this.plannedArrivalAt,
    this.plannedPickupTime,
    this.estimatedDropTime,
    this.currentPickupEtaAt,
    this.currentDropEtaAt,
    this.etaStatus,
    this.etaSource,
    this.boardingOtpRequired = false,
    this.deboardingOtpRequired = false,
  });

  factory CurrentStateStop.fromJson(Map<String, dynamic> json) =>
      CurrentStateStop(
        bookingId: _asInt(json['booking_id']),
        stopOrder: _asInt(json['stop_order']),
        employeeId: _asInt(json['employee_id']),
        employeeName: json['employee_name']?.toString(),
        employeePhone: json['employee_phone']?.toString(),
        pickupLatitude: _asDouble(json['pickup_latitude']),
        pickupLongitude: _asDouble(json['pickup_longitude']),
        pickupLocation: json['pickup_location']?.toString(),
        dropLatitude: _asDouble(json['drop_latitude']),
        dropLongitude: _asDouble(json['drop_longitude']),
        dropLocation: json['drop_location']?.toString(),
        bookingStatus:
            json['booking_status']?.toString() ?? json['status']?.toString(),
        estimatedArrivalTime: json['estimated_arrival_time']?.toString(),
        plannedArrivalAt: json['planned_arrival_at']?.toString(),
        plannedPickupTime:
            json['estimated_pickup_time']?.toString() ??
            json['estimated_pick_up_time']?.toString(),
        estimatedDropTime: json['estimated_drop_time']?.toString(),
        currentPickupEtaAt: json['current_pickup_eta_at']?.toString(),
        currentDropEtaAt:
            json['current_drop_eta_at']?.toString() ??
            json['current_eta_drop_at']?.toString() ??
            json['current_drop_eta']?.toString(),
        etaStatus: json['current_eta_calculation_status']?.toString(),
        etaSource:
            json['current_eta_routing_source']?.toString() ??
            json['current_eta_source']?.toString(),
        boardingOtpRequired:
            json['boarding_otp_required'] == true ||
            json['is_boarding_otp_required'] == true,
        deboardingOtpRequired:
            json['deboarding_otp_required'] == true ||
            json['is_deboarding_otp_required'] == true,
      );

  String? displayEtaFor(String? logType) => selectDriverEta({
    'estimated_arrival_time': estimatedArrivalTime,
    'planned_arrival_at': plannedArrivalAt,
    'current_pickup_eta_at': currentPickupEtaAt,
    'current_drop_eta_at': currentDropEtaAt,
    'estimated_pickup_time': plannedPickupTime,
    'estimated_drop_time': estimatedDropTime,
  }, logType: logType);

  bool get isApproximateEta =>
      etaStatus == 'SUCCESS' && etaSource == 'GEODESIC';

  bool get isEtaDelayed => etaStatus == 'FAILED';
}

class OnboardEmployee {
  final int? bookingId;
  final int? employeeId;
  final String? employeeName;
  final double? dropLatitude;
  final double? dropLongitude;
  final String? dropLocation;

  const OnboardEmployee({
    this.bookingId,
    this.employeeId,
    this.employeeName,
    this.dropLatitude,
    this.dropLongitude,
    this.dropLocation,
  });

  factory OnboardEmployee.fromJson(Map<String, dynamic> json) =>
      OnboardEmployee(
        bookingId: _asInt(json['booking_id']),
        employeeId: _asInt(json['employee_id']),
        employeeName: json['employee_name']?.toString(),
        dropLatitude: _asDouble(json['drop_latitude']),
        dropLongitude: _asDouble(json['drop_longitude']),
        dropLocation: json['drop_location']?.toString(),
      );
}

class DriverLocation {
  final double? latitude;
  final double? longitude;
  final double? speed;
  final String? lastGpsAt;
  final bool? isGpsFresh;

  const DriverLocation({
    this.latitude,
    this.longitude,
    this.speed,
    this.lastGpsAt,
    this.isGpsFresh,
  });

  factory DriverLocation.fromJson(Map<String, dynamic> json) => DriverLocation(
    latitude: _asDouble(json['latitude']),
    longitude: _asDouble(json['longitude']),
    speed: _asDouble(json['speed']),
    lastGpsAt: json['last_gps_at']?.toString(),
    isGpsFresh: json['is_gps_fresh'] as bool?,
  );
}

class ArrivalProximity {
  final bool? isNearPickup;
  final bool? isNearDrop;
  final double? distanceMeters;

  const ArrivalProximity({
    this.isNearPickup,
    this.isNearDrop,
    this.distanceMeters,
  });

  factory ArrivalProximity.fromJson(Map<String, dynamic> json) =>
      ArrivalProximity(
        isNearPickup: json['is_near_pickup'] as bool?,
        isNearDrop: json['is_near_drop'] as bool?,
        distanceMeters: _asDouble(json['distance_meters']),
      );
}

Map<String, dynamic>? _asMap(dynamic value) {
  return value is Map ? Map<String, dynamic>.from(value) : null;
}

int? _asInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse('$value');

double? _asDouble(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse('$value');

String? selectDriverEta(Map<String, dynamic> stop, {String? logType}) {
  final estimatedArrival = _asNonEmptyString(stop['estimated_arrival_time']);
  if (estimatedArrival != null) return estimatedArrival;

  final plannedArrival = _asNonEmptyString(stop['planned_arrival_at']);
  if (plannedArrival != null) return plannedArrival;

  if (logType?.toUpperCase() == 'OUT') {
    final liveDrop =
        _asNonEmptyString(stop['current_drop_eta_at']) ??
        _asNonEmptyString(stop['current_eta_drop_at']) ??
        _asNonEmptyString(stop['current_drop_eta']);
    return liveDrop ?? _asNonEmptyString(stop['estimated_drop_time']);
  }

  final livePickup =
      _asNonEmptyString(stop['current_pickup_eta_at']) ??
      _asNonEmptyString(stop['current_eta_pickup_at']);
  return livePickup ??
      _asNonEmptyString(stop['estimated_pickup_time']) ??
      _asNonEmptyString(stop['estimated_pick_up_time']);
}

String? _asNonEmptyString(dynamic value) {
  final text = value?.toString();
  return text == null || text.isEmpty ? null : text;
}

int findBackendStopIndex(List<dynamic> stops, CurrentStateStop? stop) {
  if (stop == null) return -1;
  final byBooking = stop.bookingId == null
      ? -1
      : stops.indexWhere(
          (item) => item['booking_id']?.toString() == stop.bookingId.toString(),
        );
  if (byBooking >= 0) return byBooking;
  if (stop.stopOrder == null) return -1;
  return stops.indexWhere(
    (item) => item['stop_order']?.toString() == stop.stopOrder.toString(),
  );
}

List<int> selectUpcomingStopIndices({
  required List<dynamic> stops,
  required String logType,
  required int currentIndex,
  CurrentStateStop? backendNextStop,
  required bool hasBackendState,
}) {
  final nextIndex = findBackendStopIndex(stops, backendNextStop);
  if (hasBackendState) {
    if (backendNextStop == null || nextIndex < 0) return const [];
    final remaining = <int>[];
    for (var index = 0; index < stops.length; index++) {
      if (index == currentIndex || index == nextIndex) continue;
      final status = stops[index]['status'];
      final isCandidate = logType == 'IN'
          ? status == 'Scheduled'
          : status == 'Ongoing';
      if (isCandidate) remaining.add(index);
    }
    return [nextIndex, ...remaining];
  }

  final result = <int>[];
  for (var index = 0; index < stops.length; index++) {
    if (index == currentIndex) continue;
    final status = stops[index]['status'];
    final isCandidate = logType == 'IN'
        ? status == 'Scheduled'
        : status == 'Ongoing';
    if (isCandidate) result.add(index);
  }
  return result;
}
