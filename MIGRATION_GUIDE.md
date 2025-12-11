# Driver App - API v2.0 Migration Guide

## 🚀 What Changed

The driver app has been updated to match the new API v2.0 flow that separates **duty management** from **trip operations**.

---

## 📋 Updated Files

### 1. `constants/config.js`
**Added new endpoints:**
```javascript
// Duty Management (New)
DUTY_START: '/api/v1/driver/duty/start'
DUTY_END: '/api/v1/driver/duty/end'

// Trip Operations (Updated)
TRIP_START: '/api/v1/driver/trip/start'
TRIP_DROP: '/api/v1/driver/trip/drop'
TRIP_NO_SHOW: '/api/v1/driver/trip/no-show'
```

### 2. `services/routeService.js`
**Added new service functions:**

#### `startDuty(routeId)`
- **Purpose**: Start driver's duty on a route
- **API**: `POST /driver/duty/start`
- **Changes**: Route status from `DRIVER_ASSIGNED` → `ONGOING`
- **Returns**: `{ success, data, message, error }`

#### `endDuty(routeId, reason?)`
- **Purpose**: End driver's duty and complete route
- **API**: `PUT /driver/duty/end`
- **Changes**: Route status from `ONGOING` → `COMPLETED`
- **Auto-processes**: All remaining bookings
- **Returns**: `{ success, data, message, error }`

#### `startTrip({ routeId, bookingId, otp?, latitude?, longitude? })`
- **Purpose**: Mark passenger pickup (boarding)
- **API**: `POST /driver/trip/start`
- **Prerequisite**: Route must be `ONGOING` (duty started)
- **Changes**: Booking status from `SCHEDULED` → `ONGOING`
- **Returns**: `{ success, data, message, error }`

#### `dropTrip({ routeId, bookingId, otp?, latitude?, longitude? })`
- **Purpose**: Mark passenger drop-off (deboarding)
- **API**: `PUT /driver/trip/drop`
- **Changes**: Booking status from `ONGOING` → `COMPLETED`
- **Returns**: `{ success, data, message, error }`

#### `markNoShow({ routeId, bookingId, reason? })`
- **Purpose**: Mark employee as no-show
- **API**: `PUT /driver/trip/no-show`
- **Changes**: Booking status to `NO_SHOW`
- **Returns**: `{ success, data, message, error }`

---

## 🔄 Migration Steps for Frontend

### Old Flow (Deprecated)
```javascript
// ❌ OLD WAY - Single endpoint did both duty start and first pickup
await fetch('/api/v1/driver/start?route_id=123&booking_id=456&otp=1234', {
  method: 'POST'
});
```

### New Flow (v2.0)
```javascript
// ✅ NEW WAY - Separate duty from trip operations

// Step 1: Start duty first
import { startDuty } from '../services/routeService';
const dutyResult = await startDuty(routeId);

// Step 2: Then start individual trips
import { startTrip } from '../services/routeService';
const tripResult = await startTrip({
  routeId,
  bookingId,
  otp: '1234',
  latitude: 14.1040427,
  longitude: 77.2868896
});

// Step 3: Drop passengers
import { dropTrip } from '../services/routeService';
const dropResult = await dropTrip({
  routeId,
  bookingId,
  otp: '5678'
});

// Step 4: Mark no-shows
import { markNoShow } from '../services/routeService';
const noShowResult = await markNoShow({
  routeId,
  bookingId,
  reason: 'Not at pickup location'
});

// Step 5: End duty when done
import { endDuty } from '../services/routeService';
const endResult = await endDuty(routeId);
```

---

## 🎯 UI/UX Recommendations

### RideDetailsScreen Updates Needed

1. **Add "Start Duty" Button**
   - Show when route status is `DRIVER_ASSIGNED`
   - Disable pickup/drop/no-show until duty started
   - Call `startDuty(routeId)` on tap

2. **Update Pickup Flow**
   - Check if duty is started (route is `ONGOING`)
   - Call `startTrip()` instead of old `/start` endpoint
   - Only changes booking status, NOT route status

3. **Update Drop Flow**
   - Call `dropTrip()` instead of manual fetch
   - Does NOT auto-complete route anymore

4. **Update No-Show Flow**
   - Call `markNoShow()` instead of manual fetch
   - Does NOT change route status

5. **Add "End Duty" Button**
   - Show when route status is `ONGOING`
   - Call `endDuty(routeId)` on tap
   - Show confirmation dialog before ending

---

## 🔐 Validation Rules (Enforced by Backend)

### startDuty()
- ✅ Route must be in `DRIVER_ASSIGNED` state
- ✅ Driver cannot have another `ONGOING` route
- ✅ Idempotent (returns success if already ONGOING)

### startTrip()
- ✅ Route must be in `ONGOING` state (duty started)
- ✅ Booking must be part of the route
- ✅ Previous stops must be completed or no-show
- ✅ Location validation (within 500m of pickup)
- ✅ OTP validation (if required)

### dropTrip()
- ✅ Route must be in `ONGOING` state
- ✅ Booking must be in `ONGOING` status
- ✅ Location validation (within 500m of drop)
- ✅ OTP validation (if required)

### markNoShow()
- ✅ Booking cannot be `ONGOING` or `COMPLETED`
- ✅ Previous stops must be finished
- ✅ Route must belong to driver

### endDuty()
- ✅ Route must be in `ONGOING` state
- ✅ Auto-processes all remaining bookings:
  - `ONGOING` → `COMPLETED` (passengers still onboard)
  - Others → `NO_SHOW` (missed pickups)
- ✅ Idempotent (returns success if already COMPLETED)

---

## 📱 Example Usage in Components

### In RideDetailsScreen.js

```javascript
import { startDuty, endDuty, startTrip, dropTrip, markNoShow } from '../services/routeService';

// Start duty button handler
const handleStartDuty = async () => {
  setLoading(true);
  const result = await startDuty(routeData.route_id);
  
  if (result.success) {
    showToast('Duty started successfully!', 'success');
    // Update route status in state
    setRouteStatus('ONGOING');
  } else {
    showToast(result.error, 'error');
  }
  setLoading(false);
};

// Pickup handler
const handlePickup = async (booking) => {
  const result = await startTrip({
    routeId: routeData.route_id,
    bookingId: booking.booking_id,
    otp: enteredOtp,
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude
  });
  
  if (result.success) {
    showToast('Passenger picked up!', 'success');
    // Update booking status in UI
  } else {
    showToast(result.error, 'error');
  }
};

// Drop handler
const handleDrop = async (booking) => {
  const result = await dropTrip({
    routeId: routeData.route_id,
    bookingId: booking.booking_id,
    otp: enteredOtp
  });
  
  if (result.success) {
    showToast('Passenger dropped!', 'success');
  } else {
    showToast(result.error, 'error');
  }
};

// No-show handler
const handleNoShow = async (booking, reason) => {
  const result = await markNoShow({
    routeId: routeData.route_id,
    bookingId: booking.booking_id,
    reason: reason
  });
  
  if (result.success) {
    showToast('Marked as no-show', 'success');
  } else {
    showToast(result.error, 'error');
  }
};

// End duty handler
const handleEndDuty = async () => {
  Alert.alert(
    'End Duty',
    'Are you sure you want to end your duty? This will complete the route.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Duty',
        style: 'destructive',
        onPress: async () => {
          const result = await endDuty(routeData.route_id);
          if (result.success) {
            showToast('Duty ended successfully!', 'success');
            navigation.goBack();
          } else {
            showToast(result.error, 'error');
          }
        }
      }
    ]
  );
};
```

---

## ⚠️ Breaking Changes

1. **Old `/start` endpoint removed** - Replace with `startDuty()` + `startTrip()`
2. **Old `/trip/end` endpoint renamed** - Now `/duty/end` via `endDuty()`
3. **Route auto-completion removed** - Must explicitly call `endDuty()`
4. **Duty state required** - Cannot pickup/drop without starting duty first

---

## ✅ Benefits of New Flow

1. **Clear Separation**: Duty management vs trip operations
2. **Better Control**: Driver explicitly starts/ends duty
3. **Prevents Conflicts**: Cannot have multiple ongoing routes
4. **Flexible**: Can handle edge cases (emergencies, late passengers)
5. **Idempotent**: Safe to retry operations
6. **Better Tracking**: Clear audit trail of duty periods

---

## 🧪 Testing Checklist

- [ ] Test start duty on `DRIVER_ASSIGNED` route
- [ ] Verify cannot start duty when another route is `ONGOING`
- [ ] Test pickup requires duty to be started first
- [ ] Verify drop doesn't auto-complete route
- [ ] Test no-show doesn't change route status
- [ ] Test end duty completes route and processes bookings
- [ ] Verify idempotent behavior (retry operations)
- [ ] Test location validation for pickup/drop
- [ ] Test OTP validation for boarding/deboarding
- [ ] Test early duty termination (emergency scenarios)

---

**Updated**: December 11, 2025  
**API Version**: 2.0  
**Status**: ✅ Backend Services Ready - Frontend Integration Pending
