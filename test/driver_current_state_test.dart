import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/models/driver_current_state.dart';

void main() {
  Map<String, dynamic> response({
    String dutyStatus = 'ON_DUTY',
    String phase = 'GOING_TO_PICKUP',
    Map<String, dynamic>? currentStop,
    Map<String, dynamic>? nextStop,
    List<Map<String, dynamic>>? onboard,
    Map<String, dynamic>? location,
    Map<String, dynamic>? proximity,
  }) {
    return {
      'duty_status': dutyStatus,
      'phase': phase,
      'route': {
        'route_id': 2580,
        'route_code': 'R-2580',
        'status': 'Ongoing',
        'total_stops': 3,
        'completed_stops': 1,
      },
      'current_stop':
          currentStop ??
          {
            'booking_id': 456,
            'stop_order': 2,
            'employee_id': 789,
            'employee_name': 'Employee One',
            'pickup_location': 'Pickup A',
            'drop_location': 'Drop A',
            'estimated_arrival_time': '09:30',
            'booking_status': 'Scheduled',
          },
      'next_stop': nextStop,
      'employees_onboard': onboard ?? const [],
      'driver_location':
          location ??
          {
            'latitude': 12.984452,
            'longitude': 77.750975,
            'speed': 32.5,
            'last_gps_at': '2026-09-10T09:20:00Z',
            'is_gps_fresh': true,
          },
      'arrival_proximity':
          proximity ??
          {
            'is_near_pickup': false,
            'is_near_drop': false,
            'distance_meters': 1250.5,
          },
    };
  }

  test('parses NOT_ON_DUTY without an operational phase', () {
    final state = DriverCurrentState.fromJson(
      response(dutyStatus: 'NOT_ON_DUTY', phase: ''),
    );

    expect(state.dutyStatus, 'NOT_ON_DUTY');
    expect(state.route, isNotNull);
    expect(state.currentStop, isNotNull);
  });

  test('parses DUTY_ASSIGNED', () {
    final state = DriverCurrentState.fromJson(
      response(dutyStatus: 'DUTY_ASSIGNED', phase: ''),
    );
    expect(state.dutyStatus, 'DUTY_ASSIGNED');
  });

  test('parses GOING_TO_PICKUP', () {
    final state = DriverCurrentState.fromJson(response());
    expect(state.phase, 'GOING_TO_PICKUP');
    expect(state.currentStop?.bookingStatus, 'Scheduled');
  });

  test('parses TRAVEL_TO_DROP', () {
    final state = DriverCurrentState.fromJson(
      response(phase: 'TRAVEL_TO_DROP'),
    );
    expect(state.phase, 'TRAVEL_TO_DROP');
  });

  test('parses COMPLETED', () {
    final state = DriverCurrentState.fromJson(
      response(dutyStatus: 'COMPLETED', phase: ''),
    );
    expect(state.dutyStatus, 'COMPLETED');
  });

  test('parses current_stop fields', () {
    final stop = DriverCurrentState.fromJson(response()).currentStop!;
    expect(stop.bookingId, 456);
    expect(stop.stopOrder, 2);
    expect(stop.employeeName, 'Employee One');
    expect(stop.pickupLocation, 'Pickup A');
    expect(stop.dropLocation, 'Drop A');
  });

  test('parses next_stop when present', () {
    final state = DriverCurrentState.fromJson(
      response(
        nextStop: {
          'booking_id': 457,
          'stop_order': 3,
          'employee_name': 'Employee Two',
          'booking_status': 'Scheduled',
        },
      ),
    );
    expect(state.nextStop?.bookingId, 457);
    expect(state.nextStop?.stopOrder, 3);
  });

  test('parses employees_onboard', () {
    final state = DriverCurrentState.fromJson(
      response(
        onboard: [
          {
            'booking_id': 455,
            'employee_id': 788,
            'employee_name': 'Onboard Employee',
            'drop_location': 'Office',
          },
        ],
      ),
    );
    expect(state.employeesOnboard, hasLength(1));
    expect(state.employeesOnboard.single.employeeName, 'Onboard Employee');
  });

  test('parses driver location and freshness', () {
    final location = DriverCurrentState.fromJson(response()).driverLocation!;
    expect(location.latitude, 12.984452);
    expect(location.longitude, 77.750975);
    expect(location.speed, 32.5);
    expect(location.isGpsFresh, isTrue);
  });

  test('parses stale GPS without changing duty state', () {
    final state = DriverCurrentState.fromJson(
      response(location: {'is_gps_fresh': false}),
    );
    expect(state.dutyStatus, 'ON_DUTY');
    expect(state.driverLocation?.isGpsFresh, isFalse);
  });

  test('parses arrival proximity', () {
    final proximity = DriverCurrentState.fromJson(response()).arrivalProximity!;
    expect(proximity.isNearPickup, isFalse);
    expect(proximity.isNearDrop, isFalse);
    expect(proximity.distanceMeters, 1250.5);
  });

  test('uses estimated_arrival_time as preferred ETA', () {
    final stop = DriverCurrentState.fromJson(response()).currentStop!;
    expect(stop.displayEtaFor('IN'), '09:30');
  });

  test('IN and OUT both prefer estimated_arrival_time', () {
    final inStop = CurrentStateStop.fromJson({
      'estimated_arrival_time': '09:30',
      'estimated_pickup_time': '09:40',
    });
    final outStop = CurrentStateStop.fromJson({
      'estimated_arrival_time': '18:30',
      'estimated_drop_time': '18:40',
      'estimated_pickup_time': '18:00',
    });
    expect(inStop.displayEtaFor('IN'), '09:30');
    expect(outStop.displayEtaFor('OUT'), '18:30');
  });

  test('OUT falls back to a live drop ETA', () {
    final stop = CurrentStateStop.fromJson({
      'current_drop_eta_at': '18:25',
      'estimated_pickup_time': '18:00',
    });
    expect(stop.displayEtaFor('OUT'), '18:25');
  });

  test('OUT falls back to estimated_drop_time', () {
    final stop = CurrentStateStop.fromJson({
      'estimated_drop_time': '18:40',
      'estimated_pick_up_time': '18:00',
    });
    expect(stop.displayEtaFor('OUT'), '18:40');
  });

  test('OUT does not use pickup ETA fields', () {
    final stop = CurrentStateStop.fromJson({
      'current_pickup_eta_at': '18:00',
      'estimated_pickup_time': '18:05',
      'estimated_pick_up_time': '18:10',
    });
    expect(stop.displayEtaFor('OUT'), isNull);
  });

  test('falls back to planned_arrival_at', () {
    final stop = CurrentStateStop.fromJson({
      'planned_arrival_at': '10:00',
      'estimated_pickup_time': '10:05',
    });
    expect(stop.displayEtaFor('IN'), '10:00');
  });

  test('falls back to planned pickup time when live ETA is absent', () {
    final stop = CurrentStateStop.fromJson({'estimated_pickup_time': '10:05'});
    expect(stop.displayEtaFor('IN'), '10:05');
  });

  test('GEODESIC is approximate ETA, not a failure', () {
    final stop = CurrentStateStop.fromJson({
      'estimated_arrival_time': '10:05',
      'current_eta_calculation_status': 'SUCCESS',
      'current_eta_routing_source': 'GEODESIC',
    });
    expect(stop.isApproximateEta, isTrue);
    expect(stop.isEtaDelayed, isFalse);
  });

  test('GOOGLE_TRAFFIC is normal ETA', () {
    final stop = CurrentStateStop.fromJson({
      'current_eta_calculation_status': 'SUCCESS',
      'current_eta_routing_source': 'GOOGLE_TRAFFIC',
    });
    expect(stop.isApproximateEta, isFalse);
    expect(stop.isEtaDelayed, isFalse);
  });

  test('GOOGLE_STANDARD is normal ETA', () {
    final stop = CurrentStateStop.fromJson({
      'current_eta_calculation_status': 'SUCCESS',
      'current_eta_routing_source': 'GOOGLE_STANDARD',
    });
    expect(stop.isApproximateEta, isFalse);
    expect(stop.isEtaDelayed, isFalse);
  });

  test('FAILED ETA retains ETA and marks delayed', () {
    final stop = CurrentStateStop.fromJson({
      'estimated_arrival_time': '10:05',
      'current_eta_calculation_status': 'FAILED',
      'current_eta_calculation_error': 'not shown to driver',
    });
    expect(stop.displayEtaFor('IN'), '10:05');
    expect(stop.isEtaDelayed, isTrue);
  });

  test('NULL ETA state falls back to planned ETA', () {
    final stop = CurrentStateStop.fromJson({
      'estimated_pickup_time': '10:05',
      'current_eta_calculation_status': null,
      'current_eta_routing_source': null,
    });
    expect(stop.displayEtaFor('IN'), '10:05');
    expect(stop.isApproximateEta, isFalse);
    expect(stop.isEtaDelayed, isFalse);
  });

  test('missing current-state fields are nullable and safe', () {
    final state = DriverCurrentState.fromJson({'duty_status': 'NOT_ON_DUTY'});
    expect(state.route, isNull);
    expect(state.currentStop, isNull);
    expect(state.nextStop, isNull);
    expect(state.driverLocation, isNull);
    expect(state.arrivalProximity, isNull);
  });

  test('backend current_stop and next_stop override local stop ordering', () {
    final stops = [
      {'booking_id': 5001, 'status': 'Scheduled'},
      {'booking_id': 5002, 'status': 'Scheduled'},
      {'booking_id': 5003, 'status': 'Scheduled'},
    ];
    final state = DriverCurrentState.fromJson({
      'duty_status': 'ON_DUTY',
      'phase': 'GOING_TO_PICKUP',
      'route': {'route_id': 1, 'log_type': 'IN'},
      'current_stop': {'booking_id': 5002, 'stop_order': 2},
      'next_stop': {'booking_id': 5003, 'stop_order': 3},
    });

    expect(findBackendStopIndex(stops, state.currentStop), 1);
    expect(
      selectUpcomingStopIndices(
        stops: stops,
        logType: 'IN',
        currentIndex: 1,
        backendNextStop: state.nextStop,
        hasBackendState: true,
      ),
      [2, 0],
    );
  });

  test('missing current-state safely uses legacy stop ordering', () {
    final stops = [
      {'booking_id': 5001, 'status': 'Scheduled'},
      {'booking_id': 5002, 'status': 'Scheduled'},
    ];
    expect(
      selectUpcomingStopIndices(
        stops: stops,
        logType: 'IN',
        currentIndex: 0,
        hasBackendState: false,
      ),
      [1],
    );
  });

  test('backend current and next stops can change after actions', () {
    final stops = [
      {'booking_id': 5001, 'status': 'Completed'},
      {'booking_id': 5002, 'status': 'Scheduled'},
      {'booking_id': 5003, 'status': 'Scheduled'},
    ];
    final afterPickup = CurrentStateStop.fromJson({'booking_id': 5002});
    final afterDrop = CurrentStateStop.fromJson({'booking_id': 5003});
    expect(findBackendStopIndex(stops, afterPickup), 1);
    expect(findBackendStopIndex(stops, afterDrop), 2);
  });
}
