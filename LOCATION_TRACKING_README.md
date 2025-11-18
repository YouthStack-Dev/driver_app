# Location Tracking Feature

This feature implements real-time driver location tracking using Firebase Realtime Database and Expo Location services.

## 📋 Features

- ✅ Real-time location tracking every 30 seconds
- ✅ Automatic location updates to Firebase on login
- ✅ Manual location updates
- ✅ Location tracking status display
- ✅ Background location permissions
- ✅ Automatic tracking stop on logout
- ✅ Error handling and user feedback
- ✅ Hierarchical Firebase data structure

## 🏗️ Firebase Data Structure

The location data is stored in Firebase Realtime Database with the following structure:

```
https://ets-1-ccb71-default-rtdb.firebaseio.com/
├── drivers/
    ├── {tenant_id}/
        ├── {vendor_id}/
            ├── {driver_id}/
                ├── driver_id: string
                ├── latitude: number
                ├── longitude: number
                ├── updated_at: string (ISO timestamp)
                ├── accuracy: number (location accuracy in meters)
                ├── timestamp: number (device timestamp)
                └── device_time: string (ISO timestamp from device)
```

### Example Data:
```json
{
  "drivers": {
    "tenant_123": {
      "vendor_456": {
        "driver_789": {
          "driver_id": "driver_789",
          "latitude": 12.9734,
          "longitude": 77.614,
          "updated_at": "2025-11-18T10:30:45.123Z",
          "accuracy": 5.0,
          "timestamp": 1700308245123,
          "device_time": "2025-11-18T10:30:45.123Z"
        }
      }
    }
  }
}
```

## 📁 New Files Created

### 1. **services/firebaseService.js**
- Firebase Realtime Database integration
- Methods for updating, reading, and listening to driver locations
- Support for hierarchical tenant/vendor/driver structure

### 2. **services/locationService.js**
- Location permissions management
- GPS coordinate retrieval using Expo Location
- Periodic location updates
- Integration with Firebase service

### 3. **context/LocationContext.js**
- React Context for location state management
- Global access to location tracking status
- Error handling and loading states

### 4. **components/LocationTracker.js**
- UI component for location tracking controls
- Start/stop tracking buttons
- Manual location update
- Real-time status display
- Current location coordinates display

### 5. **services/logoutService.js**
- Proper logout handling with location tracking cleanup
- App background/foreground state management

### 6. **config/firebase.js**
- Firebase initialization configuration

## 🔧 Configuration

### Firebase Configuration (constants/config.js)
```javascript
export const FIREBASE_CONFIG = {
  databaseURL: 'https://ets-1-ccb71-default-rtdb.firebaseio.com',
};

export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 30000, // 30 seconds
  ACCURACY: 'high', // high, balanced, low
  DISTANCE_FILTER: 10, // minimum distance in meters to trigger update
};
```

### App Permissions (app.json)
```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "This app needs access to location for driver tracking and navigation.",
      "NSLocationAlwaysAndWhenInUseUsageDescription": "This app needs access to location for driver tracking and navigation even when app is in background."
    }
  },
  "android": {
    "permissions": [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION"
    ]
  }
}
```

## 🚀 How It Works

### 1. **Automatic Tracking on Login**
- When user successfully logs in, location tracking starts automatically
- Uses driver_id, vendor_id, and tenant_id from user session
- Updates location every 30 seconds

### 2. **Manual Controls**
- Dashboard includes LocationTracker component
- Users can start/stop tracking manually
- Manual location update button for immediate updates
- Real-time status and coordinate display

### 3. **Background Tracking**
- Requests background location permissions
- Continues tracking when app is backgrounded (if permissions granted)
- Automatically resumes on app foreground

### 4. **Data Flow**
```
User Login → Get Session Data → Extract IDs → Start Location Service
     ↓
Location Service → Get GPS Coordinates → Firebase Service → Update Database
     ↓
Firebase: /drivers/{tenant_id}/{vendor_id}/{driver_id}/
```

## 📱 User Interface

The LocationTracker component provides:

- 🟢 **Active Status**: Green indicator when tracking
- 🔴 **Inactive Status**: Red indicator when not tracking
- 📍 **Location Display**: Current latitude/longitude
- 🕒 **Last Update Time**: When location was last updated
- 🔴 **Error Messages**: Clear error display with dismiss option
- 🔽 **Control Buttons**:
  - Start/Stop Tracking (primary button)
  - Update Now (manual update)
  - Get Location (test current location)

## 🔄 Integration Points

### 1. **Authentication Service Integration**
- `authService.js` automatically starts tracking after login
- `authService.js` starts tracking after company switch
- Uses existing session management

### 2. **Dashboard Integration**
- LocationTracker component added to DashboardScreen
- Provides immediate access to location controls
- Status visible to drivers at all times

### 3. **App Lifecycle Integration**
- LocationProvider wraps entire app in App.js
- Proper cleanup on logout
- Handle app background/foreground states

## 🛠️ Dependencies Added

```bash
npm install @react-native-firebase/app @react-native-firebase/database expo-location
```

## 🧪 Testing the Feature

### 1. **Location Permissions**
- First run will request location permissions
- Test both "Allow while using app" and "Allow always" permissions

### 2. **Manual Testing**
```javascript
// Test current location
const result = await locationService.getCurrentLocation();
console.log('Current location:', result);

// Test Firebase update
await firebaseService.updateDriverLocation(
  'tenant123', 'vendor456', 'driver789', 
  12.9734, 77.614, { test: true }
);

// Test tracking start/stop
await locationService.startLocationTracking();
await locationService.stopLocationTracking();
```

### 3. **Firebase Database Verification**
- Check Firebase console: https://console.firebase.google.com
- Navigate to Realtime Database
- Verify data structure: `/drivers/{tenant}/{vendor}/{driver}/`
- Monitor real-time updates

## 🐛 Troubleshooting

### Common Issues:

1. **Location Permission Denied**
   - Ensure permissions are properly configured in app.json
   - Check device location services are enabled
   - Restart app after permission changes

2. **Firebase Connection Issues**
   - Verify FIREBASE_CONFIG.databaseURL is correct
   - Check network connectivity
   - Ensure Firebase project is properly configured

3. **Location Not Updating**
   - Check location accuracy settings
   - Verify UPDATE_INTERVAL configuration
   - Test device GPS functionality

4. **Background Tracking Not Working**
   - Ensure background location permissions granted
   - Check device battery optimization settings
   - iOS: App must be backgrounded properly

## 📊 Monitoring & Analytics

### Key Metrics to Track:
- Location update frequency
- GPS accuracy values
- Permission grant rates
- Error rates and types
- Background vs foreground updates

### Firebase Console Monitoring:
- Real-time database usage
- Number of active drivers
- Update frequency per driver
- Data structure integrity

## 🔮 Future Enhancements

1. **Route Tracking**: Store location history/routes
2. **Geofencing**: Alerts when entering/leaving areas
3. **Battery Optimization**: Smart update intervals based on movement
4. **Offline Support**: Cache locations when offline
5. **Analytics Dashboard**: Admin view of all driver locations
6. **Driver Status**: Online/offline/busy status tracking

## 🚨 Important Notes

- **Privacy**: Ensure compliance with local privacy laws
- **Battery Usage**: Monitor battery consumption in production
- **Data Costs**: Consider data usage for frequent updates
- **Accuracy**: GPS accuracy varies by device and environment
- **Permissions**: Handle permission edge cases gracefully