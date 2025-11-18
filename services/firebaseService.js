import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off, connectDatabaseEmulator } from 'firebase/database';
import { FIREBASE_CONFIG } from '../constants/config';

// Firebase configuration
const firebaseConfig = {
  databaseURL: FIREBASE_CONFIG.databaseURL,
  // Add other config if needed - for now just database URL is enough
};

class FirebaseService {
  constructor() {
    try {
      // Initialize Firebase app
      this.app = initializeApp(firebaseConfig);
      
      // Get database instance
      this.database = getDatabase(this.app);
      
      console.log('🔥 Firebase SDK service initialized successfully');
      console.log('📍 Database URL:', FIREBASE_CONFIG.databaseURL);
      
    } catch (error) {
      console.warn('⚠️ Firebase SDK initialization failed (using HTTP fallback):', error.message);
      this.database = null;
      this.initializationError = error.message;
    }
  }

  // Check if database is available
  isDatabaseAvailable() {
    if (this.database === null) {
      console.log('📡 Firebase SDK not available - HTTP fallback will be used');
      return false;
    }
    return true;
  }

  /**
   * Update driver location in Firebase
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier  
   * @param {string} driverId - Driver identifier
   * @param {number} latitude - Driver latitude
   * @param {number} longitude - Driver longitude
   * @param {Object} additionalData - Any additional data to store
   */
  async updateDriverLocation(tenantId, vendorId, driverId, latitude, longitude, additionalData = {}) {
    try {
      // Check if database is available
      if (!this.isDatabaseAvailable()) {
        return { 
          success: false, 
          error: `Firebase SDK not available: ${this.initializationError || 'Database service unavailable'}. Use HTTP fallback.`,
          useHttpFallback: true
        };
      }

      const locationData = {
        driver_id: driverId,
        latitude: latitude,
        longitude: longitude,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const dbRef = ref(this.database, path);
      
      console.log('Updating Firebase location via SDK:', {
        path,
        locationData,
        databaseURL: FIREBASE_CONFIG.databaseURL
      });

      await set(dbRef, locationData);
      
      console.log('✅ Location updated successfully via Firebase SDK');
      return { success: true };
    } catch (error) {
      console.error('❌ Firebase SDK location update failed:', error);
      return { 
        success: false, 
        error: error.message,
        useHttpFallback: true
      };
    }
  }

  /**
   * Get driver location from Firebase
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   * @param {string} driverId - Driver identifier
   */
  async getDriverLocation(tenantId, vendorId, driverId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const dbRef = ref(this.database, path);
      const snapshot = await get(dbRef);
      const locationData = snapshot.val();
      
      if (locationData) {
        console.log('📍 Retrieved location data:', locationData);
        return { success: true, data: locationData };
      } else {
        console.log('📍 No location data found for driver');
        return { success: false, error: 'No location data found' };
      }
    } catch (error) {
      console.error('❌ Firebase get location failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listen to driver location changes
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   * @param {string} driverId - Driver identifier
   * @param {Function} callback - Callback function to handle location updates
   */
  listenToDriverLocation(tenantId, vendorId, driverId, callback) {
    try {
      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const dbRef = ref(this.database, path);
      
      console.log('👂 Started listening to location updates at:', path);
      
      const unsubscribe = onValue(dbRef, (snapshot) => {
        const locationData = snapshot.val();
        if (locationData && callback) {
          callback(locationData);
        }
      });
      
      return unsubscribe; // Return unsubscribe function for cleanup
    } catch (error) {
      console.error('❌ Failed to listen to location updates:', error);
      return null;
    }
  }

  /**
   * Stop listening to location updates
   * @param {Function} unsubscribe - Unsubscribe function returned by listenToDriverLocation
   */
  stopListening(unsubscribe) {
    try {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
        console.log('🔇 Stopped listening to location updates');
      }
    } catch (error) {
      console.error('❌ Failed to stop listening:', error);
    }
  }

  /**
   * Get all drivers locations for a vendor
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   */
  async getAllDriversLocations(tenantId, vendorId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}`;
      const dbRef = ref(this.database, path);
      const snapshot = await get(dbRef);
      const driversData = snapshot.val();
      
      if (driversData) {
        console.log('📍 Retrieved all drivers locations:', Object.keys(driversData).length, 'drivers');
        return { success: true, data: driversData };
      } else {
        console.log('📍 No drivers data found');
        return { success: false, error: 'No drivers data found' };
      }
    } catch (error) {
      console.error('❌ Firebase get all drivers failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove driver location data
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   * @param {string} driverId - Driver identifier
   */
  async removeDriverLocation(tenantId, vendorId, driverId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const dbRef = ref(this.database, path);
      await set(dbRef, null);
      
      console.log('🗑️ Driver location removed from Firebase');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to remove driver location:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new FirebaseService();