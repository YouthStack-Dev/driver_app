import api from './apiClient';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';

/**
 * Get driver's routes/trips by status filter
 * @param {object} params - { statusFilter, bookingDate }
 * @param {string} params.statusFilter - 'upcoming'|'ongoing'|'completed'
 * @param {string} params.bookingDate - YYYY-MM-DD format
 * @returns {Promise<{success: boolean, routes?: array, count?: number, error?: string}>}
 */
export async function getDriverTrips({ statusFilter = 'upcoming', bookingDate = null }) {
  try {
    // Format date as YYYY-MM-DD if not provided
    let dateParam = bookingDate;
    if (!dateParam) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      dateParam = `${year}-${month}-${day}`;
    }

    const url = `${BASE_URL}${API_ENDPOINTS.DRIVER_TRIPS}?status_filter=${statusFilter}&booking_date=${dateParam}`;
    
    console.log('=== Fetching Driver Trips ===');
    console.log('URL:', url);
    console.log('Status Filter:', statusFilter);
    console.log('Booking Date:', dateParam);
    
    const res = await api.get(url);
    
    console.log('Driver Trips Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success && res.data.data) {
      const routes = res.data.data.routes || [];
      const count = res.data.data.count || 0;
      
      console.log('Routes fetched:', count);
      
      return { 
        success: true, 
        routes: routes,
        count: count,
        message: res.data.message
      };
    } else {
      return { success: true, routes: [], count: 0 };
    }
  } catch (err) {
    console.log('=== Driver Trips Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      
      let errorMessage = 'Failed to fetch routes';
      
      if (err.response.data) {
        const data = err.response.data;
        
        if (data.detail && typeof data.detail.message === 'string') {
          errorMessage = data.detail.message;
        } else if (typeof data.message === 'string') {
          errorMessage = data.message;
        } else if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        }
      }
      
      return { success: false, error: errorMessage };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Start driver's duty on a route (v2.0)
 * Changes route status from DRIVER_ASSIGNED → ONGOING
 * @param {number} routeId - Route ID to start duty on
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function startDuty(routeId) {
  try {
    const url = `${BASE_URL}${API_ENDPOINTS.DUTY_START}?route_id=${routeId}`;
    
    console.log('=== Starting Duty ===');
    console.log('Route ID:', routeId);
    console.log('URL:', url);
    
    const res = await api.post(url);
    
    console.log('Start Duty Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success) {
      return {
        success: true,
        data: res.data.data,
        message: res.data.message
      };
    }
    
    return { success: false, error: 'Failed to start duty' };
  } catch (err) {
    console.log('=== Start Duty Error ===');
    console.log('Error:', err.message);
    
    if (err.response && err.response.data) {
      const data = err.response.data;
      console.log('Error Response Data:', JSON.stringify(data, null, 2));
      
      let errorMessage = 'Failed to start duty';
      
      // Handle FastAPI validation errors (422 status)
      if (err.response.status === 422 && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          }).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data.detail === 'object') {
          errorMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
      } else {
        errorMessage = data.message || data.detail || data.error || 'Failed to start duty';
      }
      
      let errorCode = data.error_code || null;
      let details = data.details || null;
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        details: details
      };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * End driver's duty and complete the route (v2.0)
 * Changes route status from ONGOING → COMPLETED
 * @param {number} routeId - Route ID to end duty on
 * @param {string} reason - Optional reason for early termination
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function endDuty(routeId, reason = null) {
  try {
    let url = `${BASE_URL}${API_ENDPOINTS.DUTY_END}?route_id=${routeId}`;
    if (reason) {
      url += `&reason=${encodeURIComponent(reason)}`;
    }
    
    console.log('=== Ending Duty ===');
    console.log('Route ID:', routeId);
    console.log('URL:', url);
    
    const res = await api.put(url);
    
    console.log('End Duty Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success) {
      return {
        success: true,
        data: res.data.data,
        message: res.data.message
      };
    }
    
    return { success: false, error: 'Failed to end duty' };
  } catch (err) {
    console.log('=== End Duty Error ===');
    console.log('Error:', err.message);
    
    if (err.response && err.response.data) {
      const data = err.response.data;
      console.log('Error Response Data:', JSON.stringify(data, null, 2));
      
      let errorMessage = 'Failed to end duty';
      let errorCode = null;
      let details = null;
      
      // Handle 400 errors with detail object (business logic errors)
      if (err.response.status === 400 && data.detail && typeof data.detail === 'object') {
        errorMessage = data.detail.message || 'Request failed';
        errorCode = data.detail.error_code || null;
        details = data.detail.details || null;
      }
      // Handle FastAPI validation errors (422 status)
      else if (err.response.status === 422 && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          }).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data.detail === 'object') {
          errorMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
      }
      // Handle 404 errors
      else if (err.response.status === 404 && data.detail) {
        if (typeof data.detail === 'object') {
          errorMessage = data.detail.message || 'Not found';
          errorCode = data.detail.error_code || null;
        } else {
          errorMessage = data.detail;
        }
      }
      // Handle other error formats
      else {
        errorMessage = data.message || data.detail || data.error || 'Failed to end duty';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        details: details
      };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Start trip - Mark passenger pickup (v2.0)
 * Changes booking status from REQUEST/SCHEDULED → ONGOING
 * @param {object} params - { routeId, bookingId, otp, latitude, longitude }
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function startTrip({ routeId, bookingId, otp, latitude, longitude }) {
  try {
    let url = `${BASE_URL}${API_ENDPOINTS.TRIP_START}?route_id=${routeId}&booking_id=${bookingId}`;
    
    if (otp) {
      url += `&otp=${otp}`;
    }
    if (latitude !== undefined && longitude !== undefined) {
      url += `&current_latitude=${latitude}&current_longitude=${longitude}`;
    }
    
    console.log('=== Starting Trip (Pickup) ===');
    console.log('Route ID:', routeId);
    console.log('Booking ID:', bookingId);
    console.log('URL:', url);
    
    const res = await api.post(url);
    
    console.log('Start Trip Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success) {
      return {
        success: true,
        data: res.data.data,
        message: res.data.message
      };
    }
    
    return { success: false, error: 'Failed to start trip' };
  } catch (err) {
    console.log('=== Start Trip Error ===');
    console.log('Error:', err.message);
    
    if (err.response && err.response.data) {
      const data = err.response.data;
      console.log('Error Response Data:', JSON.stringify(data, null, 2));
      
      let errorMessage = 'Failed to start trip';
      let errorCode = null;
      let details = null;
      
      // Handle 400 errors with detail object (business logic errors)
      if (err.response.status === 400 && data.detail && typeof data.detail === 'object') {
        errorMessage = data.detail.message || 'Request failed';
        errorCode = data.detail.error_code || null;
        details = data.detail.details || null;
      }
      // Handle FastAPI validation errors (422 status)
      else if (err.response.status === 422 && data.detail) {
        if (Array.isArray(data.detail)) {
          // Validation errors array
          errorMessage = data.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          }).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data.detail === 'object') {
          errorMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
      }
      // Handle 404 errors
      else if (err.response.status === 404 && data.detail) {
        if (typeof data.detail === 'object') {
          errorMessage = data.detail.message || 'Not found';
          errorCode = data.detail.error_code || null;
        } else {
          errorMessage = data.detail;
        }
      }
      // Handle other error formats
      else {
        errorMessage = data.message || data.detail || data.error || 'Failed to start trip';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        details: details
      };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Drop passenger (v2.0)
 * Changes booking status from ONGOING → COMPLETED
 * @param {object} params - { routeId, bookingId, otp, latitude, longitude }
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function dropTrip({ routeId, bookingId, otp, latitude, longitude }) {
  try {
    let url = `${BASE_URL}${API_ENDPOINTS.TRIP_DROP}?route_id=${routeId}&booking_id=${bookingId}`;
    
    if (otp) {
      url += `&otp=${otp}`;
    }
    if (latitude !== undefined && longitude !== undefined) {
      url += `&current_latitude=${latitude}&current_longitude=${longitude}`;
    }
    
    console.log('=== Dropping Passenger ===');
    console.log('Route ID:', routeId);
    console.log('Booking ID:', bookingId);
    console.log('URL:', url);
    
    const res = await api.put(url);
    
    console.log('Drop Trip Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success) {
      return {
        success: true,
        data: res.data.data,
        message: res.data.message
      };
    }
    
    return { success: false, error: 'Failed to drop passenger' };
  } catch (err) {
    console.log('=== Drop Trip Error ===');
    console.log('Error:', err.message);
    
    if (err.response && err.response.data) {
      const data = err.response.data;
      console.log('Error Response Data:', JSON.stringify(data, null, 2));
      
      let errorMessage = 'Failed to drop passenger';
      let errorCode = null;
      let details = null;
      
      // Handle 400 errors with detail object (business logic errors)
      if (err.response.status === 400 && data.detail && typeof data.detail === 'object') {
        errorMessage = data.detail.message || 'Request failed';
        errorCode = data.detail.error_code || null;
        details = data.detail.details || null;
      }
      // Handle FastAPI validation errors (422 status)
      else if (err.response.status === 422 && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          }).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data.detail === 'object') {
          errorMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
      }
      // Handle 404 errors
      else if (err.response.status === 404 && data.detail) {
        if (typeof data.detail === 'object') {
          errorMessage = data.detail.message || 'Not found';
          errorCode = data.detail.error_code || null;
        } else {
          errorMessage = data.detail;
        }
      }
      // Handle other error formats
      else {
        errorMessage = data.message || data.detail || data.error || 'Failed to drop passenger';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        details: details
      };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Mark passenger as no-show (v2.0)
 * Changes booking status to NO_SHOW
 * @param {object} params - { routeId, bookingId, reason }
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function markNoShow({ routeId, bookingId, reason }) {
  try {
    let url = `${BASE_URL}${API_ENDPOINTS.TRIP_NO_SHOW}?route_id=${routeId}&booking_id=${bookingId}`;
    
    if (reason) {
      url += `&reason=${encodeURIComponent(reason)}`;
    }
    
    console.log('=== Marking No-Show ===');
    console.log('Route ID:', routeId);
    console.log('Booking ID:', bookingId);
    console.log('Reason:', reason);
    console.log('URL:', url);
    
    const res = await api.put(url);
    
    console.log('No-Show Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success) {
      return {
        success: true,
        data: res.data.data,
        message: res.data.message
      };
    }
    
    return { success: false, error: 'Failed to mark no-show' };
  } catch (err) {
    console.log('=== No-Show Error ===');
    console.log('Error:', err.message);
    
    if (err.response && err.response.data) {
      const data = err.response.data;
      console.log('Error Response Data:', JSON.stringify(data, null, 2));
      
      let errorMessage = 'Failed to mark no-show';
      let errorCode = null;
      let details = null;
      
      // Handle 400 errors with detail object (business logic errors)
      if (err.response.status === 400 && data.detail && typeof data.detail === 'object') {
        errorMessage = data.detail.message || 'Request failed';
        errorCode = data.detail.error_code || null;
        details = data.detail.details || null;
      }
      // Handle FastAPI validation errors (422 status)
      else if (err.response.status === 422 && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(err => {
            const field = err.loc ? err.loc.join('.') : 'field';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          }).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (typeof data.detail === 'object') {
          errorMessage = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
      }
      // Handle 404 errors
      else if (err.response.status === 404 && data.detail) {
        if (typeof data.detail === 'object') {
          errorMessage = data.detail.message || 'Not found';
          errorCode = data.detail.error_code || null;
        } else {
          errorMessage = data.detail;
        }
      }
      // Handle other error formats
      else {
        errorMessage = data.message || data.detail || data.error || 'Failed to mark no-show';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        details: details
      };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Helper: Set active duty status in local storage
 */
export async function setActiveDutyStatus() {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('has_active_duty', 'true');
    console.log('✅ Active duty status set');
  } catch (error) {
    console.log('Error setting duty status:', error);
  }
}

/**
 * Helper: Clear active duty status from local storage
 */
export async function clearActiveDutyStatus() {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem('has_active_duty');
    console.log('✅ Active duty status cleared');
  } catch (error) {
    console.log('Error clearing duty status:', error);
  }
}

/**
 * Helper: Check if driver has active duty
 */
export async function checkActiveDutyStatus() {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const status = await AsyncStorage.getItem('has_active_duty');
    return status === 'true';
  } catch (error) {
    console.log('Error checking duty status:', error);
    return false;
  }
}
