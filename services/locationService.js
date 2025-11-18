import * as Location from 'expo-location';
import { LOCATION_CONFIG } from '../constants/config';
import firebaseService from './firebaseService';
import httpFirebaseService from './httpFirebaseService';
import sessionService from './sessionService';
import locationPermissionService from './locationPermissionService';
import { Alert } from 'react-native';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.locationSubscription = null;
    this.lastKnownLocation = null;
    this.updateInterval = null;
    this.permissionMonitoringActive = false;
    this.onPermissionLost = null;
    
    // Initialize permission monitoring
    this.initializePermissionMonitoring();
  }

  /**
   * Initialize permission monitoring
   */
  async initializePermissionMonitoring() {
    try {
      await locationPermissionService.initialize((permissionStatus) => {
        this.handlePermissionChange(permissionStatus);
      });
      this.permissionMonitoringActive = true;
      console.log('✅ Location permission monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize permission monitoring:', error);
    }
  }

  /**
   * Handle permission changes
   */
  handlePermissionChange(permissionStatus) {
    console.log('🔄 Location permission status changed:', permissionStatus);
    
    if (!permissionStatus.hasAll && this.isTracking) {
      console.log('⚠️ Location permissions lost, stopping tracking');
      this.stopLocationTracking();
      
      // Show alert to user
      Alert.alert(
        '📍 Location Access Lost',
        'Location permissions were revoked. Location tracking has been stopped. Please grant permissions again to continue.',
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Grant Permission',
            onPress: () => this.requestLocationPermissions()
          }
        ]
      );
      
      // Notify callback if set
      if (this.onPermissionLost) {
        this.onPermissionLost(permissionStatus);
      }
    }
  }

  /**
   * Set callback for permission lost events
   */
  setPermissionLostCallback(callback) {
    this.onPermissionLost = callback;
  }

  /**
   * Request location permissions using comprehensive service
   */
  async requestLocationPermissions() {
    try {
      console.log('🔒 Checking location permissions...');
      
      // Check if location services are enabled
      const servicesEnabled = await locationPermissionService.checkLocationServicesEnabled();
      if (!servicesEnabled) {
        return { success: false, error: 'Location services disabled on device' };
      }
      
      // Request permissions using the comprehensive service
      const result = await locationPermissionService.checkAndRequestPermissions(true);
      
      if (!result.success) {
        console.error('❌ Location permission request failed:', result.error);
        return { success: false, error: result.error };
      }
      
      const permissions = result.permissions;
      
      if (permissions.hasAll) {
        console.log('✅ All location permissions granted');
        return { success: true, background: true, foreground: true };
      } else if (permissions.foreground.granted) {
        console.log('⚠️ Only foreground permission available');
        return { 
          success: true, 
          warning: 'Background location not available',
          foreground: true,
          background: false
        };
      } else {
        return { success: false, error: 'Location permissions denied' };
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current location with permission validation
   */
  async getCurrentLocation() {
    try {
      console.log('📍 Getting current location...');
      
      // Validate permissions before getting location
      const permissions = await locationPermissionService.getCurrentPermissionStatus();
      if (!permissions.foreground.granted) {
        console.log('❌ Location permission not available');
        locationPermissionService.showFeatureBlockedAlert('location access');
        return { success: false, error: 'Location permission required' };
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      console.log('📍 Current location:', locationData);
      this.lastKnownLocation = locationData;
      
      return { success: true, location: locationData };
    } catch (error) {
      console.error('❌ Get current location failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start location tracking with comprehensive permission checks
   */
  async startLocationTracking() {
    try {
      if (this.isTracking) {
        console.log('⚠️ Location tracking already active');
        return { success: true, message: 'Already tracking' };
      }

      // First check current permission status without prompting
      const currentPermissions = await locationPermissionService.getCurrentPermissionStatus();
      
      if (!currentPermissions.hasAll) {
        console.log('❌ Insufficient location permissions for tracking');
        locationPermissionService.showFeatureBlockedAlert('location tracking');
        return { success: false, error: 'Location permissions required' };
      }

      // Double-check permissions with request if needed
      const permissionResult = await this.requestLocationPermissions();
      if (!permissionResult.success) {
        return permissionResult;
      }

      // Get user session data
      const session = await sessionService.getSession();
      if (!session?.user_data) {
        return { success: false, error: 'No user session found' };
      }

      const userData = session.user_data;
      
      // Extract IDs using the same logic as sessionService
      const driverId = userData.driver_id || 
                      (userData.user && userData.user.driver && userData.user.driver.driver_id) || 
                      (userData.user && userData.user.driver_id) || 
                      (userData.driver && userData.driver.driver_id) ||
                      userData.id;
                      
      const vendorId = userData.vendor_id || 
                      (userData.account && userData.account.vendor_id) || 
                      (userData.user && userData.user.driver && userData.user.driver.vendor_id) ||
                      (userData.vendor && userData.vendor.id);
                      
      const tenantId = userData.tenant_id || 
                      (userData.account && userData.account.tenant_id) || 
                      (userData.user && userData.user.tenant_id) || 
                      (userData.user && userData.user.tenant && userData.user.tenant.tenant_id) ||
                      (userData.user && userData.user.driver && userData.user.driver.tenant_id) ||
                      (userData.tenant && userData.tenant.id);

      console.log('📋 Extracted session data:', {
        driverId,
        vendorId, 
        tenantId,
        userDataKeys: Object.keys(userData),
        fullUserData: userData,
        // Debug specific paths
        'userData.user': userData.user ? 'exists' : 'missing',
        'userData.user.tenant': userData.user?.tenant ? 'exists' : 'missing', 
        'userData.user.tenant.tenant_id': userData.user?.tenant?.tenant_id || 'missing',
        'direct tenant check': userData.tenant_id || 'missing'
      });

      if (!driverId || !vendorId || !tenantId) {
        console.error('❌ Missing required IDs:', { driverId, vendorId, tenantId });
        console.error('📄 Full user_data for debugging:', JSON.stringify(userData, null, 2));
        return { success: false, error: 'Missing driver, vendor, or tenant information' };
      }

      console.log('🚀 Starting location tracking for:', { driverId, vendorId, tenantId });

      this.isTracking = true;

      // Start periodic location updates
      this.updateInterval = setInterval(async () => {
        await this.updateLocationToFirebase(tenantId, vendorId, driverId);
      }, LOCATION_CONFIG.UPDATE_INTERVAL);

      // Initial location update
      await this.updateLocationToFirebase(tenantId, vendorId, driverId);

      console.log('✅ Location tracking started successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to start location tracking:', error);
      this.isTracking = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop location tracking
   */
  async stopLocationTracking() {
    try {
      console.log('🛑 Stopping location tracking...');

      this.isTracking = false;

      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      console.log('✅ Location tracking stopped');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to stop location tracking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update location to Firebase
   */
  async updateLocationToFirebase(tenantId, vendorId, driverId, additionalData = {}) {
    try {
      const locationResult = await this.getCurrentLocation();
      
      if (!locationResult.success) {
        console.log('❌ Failed to get location for Firebase update');
        return locationResult;
      }

      const { latitude, longitude } = locationResult.location;

      // Add additional driver/device info
      const locationData = {
        accuracy: locationResult.location.accuracy,
        timestamp: locationResult.location.timestamp,
        device_time: new Date().toISOString(),
        ...additionalData
      };

      console.log('🔄 Attempting Firebase update...');

      // Try SDK first, fallback to HTTP if it fails
      let result = await firebaseService.updateDriverLocation(
        tenantId, 
        vendorId, 
        driverId, 
        latitude, 
        longitude, 
        locationData
      );

      // If SDK fails or suggests HTTP fallback, try HTTP method
      if (!result.success && (result.useHttpFallback || result.error.includes('not available'))) {
        console.log('🔄 Firebase SDK failed, using HTTP fallback...');
        result = await httpFirebaseService.updateDriverLocation(
          tenantId, 
          vendorId, 
          driverId, 
          latitude, 
          longitude, 
          { ...locationData, method: 'http_fallback' }
        );
      }

      if (result.success) {
        console.log('✅ Location updated to Firebase successfully');
      } else {
        console.log('❌ Both Firebase methods failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('❌ Update location to Firebase failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tracking status
   */
  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      lastKnownLocation: this.lastKnownLocation,
      hasLocationSubscription: !!this.locationSubscription,
    };
  }

  /**
   * Manual location update (for testing or on-demand updates)
   */
  async manualLocationUpdate() {
    try {
      const session = await sessionService.getSession();
      if (!session?.user_data) {
        return { success: false, error: 'No user session found' };
      }

      const userData = session.user_data;
      
      // Extract IDs using the same logic as sessionService
      const driverId = userData.driver_id || 
                      (userData.user && userData.user.driver && userData.user.driver.driver_id) || 
                      (userData.user && userData.user.driver_id) || 
                      (userData.driver && userData.driver.driver_id) ||
                      userData.id;
                      
      const vendorId = userData.vendor_id || 
                      (userData.account && userData.account.vendor_id) || 
                      (userData.user && userData.user.driver && userData.user.driver.vendor_id) ||
                      (userData.vendor && userData.vendor.id);
                      
      const tenantId = userData.tenant_id || 
                      (userData.account && userData.account.tenant_id) || 
                      (userData.user && userData.user.tenant_id) || 
                      (userData.user && userData.user.driver && userData.user.driver.tenant_id) ||
                      (userData.user && userData.user.tenant && userData.user.tenant.tenant_id) || // Added this line
                      (userData.tenant && userData.tenant.id);

      // Additional debugging for tenant_id
      console.log('🔍 Tenant ID extraction debug:', {
        'userData.tenant_id': userData.tenant_id,
        'userData.user?.tenant?.tenant_id': userData.user?.tenant?.tenant_id,
        'extracted tenantId': tenantId
      });

      if (!driverId || !vendorId || !tenantId) {
        console.error('❌ Missing required IDs for manual update:', { driverId, vendorId, tenantId });
        return { success: false, error: 'Missing driver, vendor, or tenant information' };
      }

      console.log('📍 Manual location update triggered');
      return await this.updateLocationToFirebase(tenantId, vendorId, driverId, { manual_update: true });
    } catch (error) {
      console.error('❌ Manual location update failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new LocationService();