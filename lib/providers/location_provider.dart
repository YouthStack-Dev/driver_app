import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../services/location_service.dart';
import '../services/location_repository.dart'; // Ensure repository is loaded/initialized
import '../services/session_service.dart';
import '../services/driver_config_service.dart';
import '../services/speed_violation_service.dart';
import '../config/constants.dart';

enum ActionLocationIssue {
  none,
  serviceDisabled,
  permissionDenied,
  unavailable,
  stale,
  inaccurate,
}

class ActionLocationResult {
  final Position? position;
  final ActionLocationIssue issue;
  final String message;

  const ActionLocationResult._({
    this.position,
    required this.issue,
    required this.message,
  });

  bool get isValid => issue == ActionLocationIssue.none && position != null;

  factory ActionLocationResult.success(Position position) {
    return ActionLocationResult._(
      position: position,
      issue: ActionLocationIssue.none,
      message: '',
    );
  }

  factory ActionLocationResult.failure(
    ActionLocationIssue issue,
    String message,
  ) {
    return ActionLocationResult._(issue: issue, message: message);
  }
}

ActionLocationIssue validateActionPosition(
  Position position, {
  DateTime? now,
  Duration maxAge = const Duration(
    seconds: LocationConfig.maxActionLocationAgeSeconds,
  ),
  double maxAccuracyMeters = LocationConfig.maxActionLocationAccuracyMeters,
}) {
  if (!position.latitude.isFinite ||
      !position.longitude.isFinite ||
      position.latitude.abs() > 90 ||
      position.longitude.abs() > 180) {
    return ActionLocationIssue.unavailable;
  }

  final age = (now ?? DateTime.now()).difference(position.timestamp);
  if (age > maxAge || age < const Duration(seconds: -5)) {
    return ActionLocationIssue.stale;
  }

  if (!position.accuracy.isFinite || position.accuracy <= 0) {
    return ActionLocationIssue.unavailable;
  }
  if (position.accuracy > maxAccuracyMeters) {
    return ActionLocationIssue.inaccurate;
  }

  return ActionLocationIssue.none;
}

class LocationProvider extends ChangeNotifier {
  final LocationService _locationService = LocationService();
  final DriverConfigService _driverConfigService = DriverConfigService();

  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<bool>? _trackingStateSubscription;
  StreamSubscription<bool>? _permissionSubscription;

  double _currentSpeedKmh = 0.0;
  bool _isSpeedLimitExceeded = false;
  bool _hasGpsPermission = true;
  Position? _lastPosition; // Cache for instant use in OTP actions

  double get currentSpeedKmh => _currentSpeedKmh;
  bool get isSpeedLimitExceeded => _isSpeedLimitExceeded;
  bool get hasGpsPermission => _hasGpsPermission;
  Position? get lastPosition => _lastPosition;

  /// The effective speed limit from the last-fetched driver config.
  double get speedLimitKmh => _driverConfigService.config.speedLimitKmph;

  bool get isTracking => _locationService.isTracking;

  LocationProvider() {
    // Seed initial position from last known location
    Geolocator.getLastKnownPosition()
        .then((pos) {
          if (pos != null && _lastPosition == null) {
            _lastPosition = pos;
            notifyListeners();
          }
        })
        .catchError((_) {});

    // Fast fallback check
    Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.low,
          ),
        )
        .then((pos) {
          if (_lastPosition == null) {
            _lastPosition = pos;
            notifyListeners();
          }
        })
        .catchError((_) {});

    // Initialize the LocationRepository singleton so it subscribes to positionStream
    LocationRepository();

    // Listen to GPS positions
    _positionSubscription = _locationService.positionStream.listen(_onPosition);

    // Listen to tracking start/stop so the HUD appears immediately when
    // AuthProvider starts tracking (without waiting for first GPS fix)
    _trackingStateSubscription = _locationService.trackingStateStream.listen((
      _,
    ) {
      notifyListeners();
    });

    // Listen to permission changes
    _hasGpsPermission = _locationService.hasPermission;
    _permissionSubscription = _locationService.permissionStateStream.listen((
      hasPerm,
    ) {
      _hasGpsPermission = hasPerm;
      notifyListeners();
    });

    // Restore active route state on startup
    _restoreActiveRoute();

    // Fix race condition: AuthProvider calls startTracking() before
    // LocationProvider is created in MultiProvider, so the trackingStateStream
    // event fires before this subscriber exists and is silently dropped.
    // If tracking is already active at construction time, notify immediately.
    if (_locationService.isTracking) {
      Future.microtask(notifyListeners);
    }
  }

  Future<void> _restoreActiveRoute() async {
    try {
      final activeRouteId = await SessionService().getActiveRoute();
      final activeVehicleId = await SessionService().getActiveVehicle();
      if (activeRouteId != null && activeRouteId.isNotEmpty) {
        debugPrint(
          '🔄 LocationProvider: Restoring active route state: $activeRouteId, vehicle: $activeVehicleId',
        );
        _locationService.activeRouteId = activeRouteId;
        _locationService.activeVehicleId = activeVehicleId;
        notifyListeners();
      }
    } catch (e) {
      debugPrint(
        '⚠️ LocationProvider: Failed to restore active route state: $e',
      );
    }
  }

  void _onPosition(Position position) {
    _lastPosition = position;
    // position.speed returns -1.0 when GPS fix is not yet acquired — clamp to 0
    final speedMs = position.speed < 0 ? 0.0 : position.speed;
    _currentSpeedKmh = speedMs * 3.6; // m/s → km/h
    _isSpeedLimitExceeded = _currentSpeedKmh > speedLimitKmh;

    // Report speed violations while on an active duty route
    if (_isSpeedLimitExceeded && _locationService.activeRouteId != null) {
      SpeedViolationService().reportViolation(
        routeId: _locationService.activeRouteId!,
        vehicleId: _locationService.activeVehicleId,
        speedKmph: _currentSpeedKmh,
        speedLimitKmph: speedLimitKmh,
        latitude: position.latitude,
        longitude: position.longitude,
      );
    }

    notifyListeners();
  }

  Future<bool> toggleTracking() async {
    if (_locationService.isTracking) {
      await _locationService.stopTracking();
    } else {
      await _locationService.startTracking();
    }
    notifyListeners();
    return _locationService.isTracking;
  }

  /// Returns a position as fast as possible:
  /// 1. Use cached last-known position if available (instant — already tracking)
  /// 2. Fall back to getLastKnownPosition() (fast, system-cached)
  /// 3. Final fallback: getCurrentPosition() with 10-second timeout
  Future<Position?> getCurrentLocation() async {
    // Fast path — already have a recent fix from the tracking stream
    if (_lastPosition != null) return _lastPosition;

    // Second path — ask the OS for its cached last-known position
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) return last;
    } catch (_) {}

    // Slow path — request a fresh fix with a hard timeout
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<ActionLocationResult> getFreshActionLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return ActionLocationResult.failure(
        ActionLocationIssue.serviceDisabled,
        'Location services are turned off. Turn them on to verify the stop, then try again.',
      );
    }

    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return ActionLocationResult.failure(
        ActionLocationIssue.permissionDenied,
        'Location permission is required to verify the stop. Enable precise location access for the app, then try again.',
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(
            seconds: LocationConfig.actionLocationTimeoutSeconds,
          ),
        ),
      );

      final issue = validateActionPosition(position);
      if (issue == ActionLocationIssue.stale) {
        return ActionLocationResult.failure(
          issue,
          'Location fix is stale. Wait for a fresh GPS fix, then try again.',
        );
      }
      if (issue == ActionLocationIssue.inaccurate) {
        return ActionLocationResult.failure(
          issue,
          'GPS accuracy is too low (${position.accuracy.toStringAsFixed(0)} m). Wait for a better GPS fix, then try again.',
        );
      }
      if (issue != ActionLocationIssue.none) {
        return ActionLocationResult.failure(
          issue,
          'Unable to get a valid location. Move to an open area or improve GPS signal, then try again.',
        );
      }

      _lastPosition = position;
      notifyListeners();
      return ActionLocationResult.success(position);
    } on TimeoutException {
      return ActionLocationResult.failure(
        ActionLocationIssue.unavailable,
        'Unable to get a fresh GPS fix. Move to an open area or improve GPS signal, then try again.',
      );
    } catch (_) {
      return ActionLocationResult.failure(
        ActionLocationIssue.unavailable,
        'Unable to get a fresh GPS fix. Move to an open area or improve GPS signal, then try again.',
      );
    }
  }

  /// Tells LocationService which route is currently active so that speed
  /// violations are tagged with the correct route_id.
  /// Pass null when duty ends.
  void setActiveRoute(String? routeId, {int? vehicleId}) {
    _locationService.activeRouteId = routeId;
    _locationService.activeVehicleId = vehicleId;
    notifyListeners();
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _trackingStateSubscription?.cancel();
    _permissionSubscription?.cancel();
    super.dispose();
  }
}
