import * as Location from 'expo-location';
import { LOCATION_CONFIG } from '../constants/config';
import firebaseService from './firebaseService';
import httpFirebaseService from './httpFirebaseService';
import sessionService from './sessionService';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.locationSubscription = null;
    this.lastKnownLocation = null;
    this.updateInterval = null;
  }

  /**
   * Request location permissions
   */
  async requestLocationPermissions() {
    try {
      console.log('🔒 Requesting location permissions...');
      
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('❌ Foreground location permission denied');
        return { success: false, error: 'Location permission denied' };
      }

      console.log('✅ Foreground location permission granted');

      // Optional: Request background permissions for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.log('⚠️ Background location permission denied - will track only in foreground');
      } else {
        console.log('✅ Background location permission granted');
      }

      return { 
        success: true, 
        foreground: foregroundStatus === 'granted',
        background: backgroundStatus === 'granted'
      };
    } catch (error) {
      console.error('❌ Location permission error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation() {
    try {
      console.log('📍 Getting current location...');
      
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
   * Start location tracking
   */
  async startLocationTracking() {
    try {
      if (this.isTracking) {
        console.log('⚠️ Location tracking already active');
        return { success: true, message: 'Already tracking' };
      }

      // Check permissions
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