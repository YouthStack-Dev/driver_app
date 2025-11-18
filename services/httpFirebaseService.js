import { FIREBASE_CONFIG } from '../constants/config';

class HttpFirebaseService {
  constructor() {
    this.baseUrl = FIREBASE_CONFIG.databaseURL;
    console.log('🔗 HTTP Firebase service initialized');
    console.log('📍 Database URL:', this.baseUrl);
  }

  /**
   * Update driver location using HTTP requests
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier  
   * @param {string} driverId - Driver identifier
   * @param {number} latitude - Driver latitude
   * @param {number} longitude - Driver longitude
   * @param {Object} additionalData - Any additional data to store
   */
  async updateDriverLocation(tenantId, vendorId, driverId, latitude, longitude, additionalData = {}) {
    try {
      const locationData = {
        driver_id: driverId,
        latitude: latitude,
        longitude: longitude,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const url = `${this.baseUrl}/${path}.json`;
      
      console.log('Updating Firebase location via HTTP:', {
        url,
        locationData
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Location updated successfully via HTTP:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ HTTP Firebase location update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get driver location using HTTP request
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   * @param {string} driverId - Driver identifier
   */
  async getDriverLocation(tenantId, vendorId, driverId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const url = `${this.baseUrl}/${path}.json`;
      
      console.log('Getting Firebase location via HTTP:', url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const locationData = await response.json();
      
      if (locationData) {
        console.log('📍 Retrieved location data via HTTP:', locationData);
        return { success: true, data: locationData };
      } else {
        console.log('📍 No location data found for driver');
        return { success: false, error: 'No location data found' };
      }
    } catch (error) {
      console.error('❌ HTTP Firebase get location failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all drivers locations for a vendor using HTTP
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   */
  async getAllDriversLocations(tenantId, vendorId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}`;
      const url = `${this.baseUrl}/${path}.json`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const driversData = await response.json();
      
      if (driversData) {
        console.log('📍 Retrieved all drivers locations via HTTP:', Object.keys(driversData).length, 'drivers');
        return { success: true, data: driversData };
      } else {
        console.log('📍 No drivers data found');
        return { success: false, error: 'No drivers data found' };
      }
    } catch (error) {
      console.error('❌ HTTP Firebase get all drivers failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove driver location data using HTTP
   * @param {string} tenantId - Tenant identifier
   * @param {string} vendorId - Vendor identifier
   * @param {string} driverId - Driver identifier
   */
  async removeDriverLocation(tenantId, vendorId, driverId) {
    try {
      const path = `drivers/${tenantId}/${vendorId}/${driverId}`;
      const url = `${this.baseUrl}/${path}.json`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('🗑️ Driver location removed from Firebase via HTTP');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to remove driver location via HTTP:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new HttpFirebaseService();