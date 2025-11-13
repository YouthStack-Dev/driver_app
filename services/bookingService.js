import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getEmployeeBookings({ employeeId, skip = 0, limit = 100 }) {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    // Remove status_filter from URL - we'll filter on frontend
    const url = `${BASE_URL}${API_ENDPOINTS.BOOKINGS}?employee_id=${employeeId}&skip=${skip}&limit=${limit}`;
    
    console.log('=== Fetching Bookings ===');
    console.log('URL:', url);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Bookings Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.data) {
      return { success: true, bookings: res.data.data };
    } else {
      return { success: true, bookings: [] };
    }
  } catch (err) {
    console.log('=== Bookings Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      const errorMessage = err.response.data?.detail?.message 
        || err.response.data?.message 
        || 'Failed to fetch bookings';
      return { success: false, error: errorMessage };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function createBooking({ tenantId, employeeId, bookingDates, shiftId }) {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const url = `${BASE_URL}${API_ENDPOINTS.CREATE_BOOKING}/`;
    
    const payload = {
      tenant_id: tenantId,
      employee_id: employeeId,
      booking_dates: bookingDates,
      shift_id: shiftId,
    };

    console.log('=== Creating Booking ===');
    console.log('URL:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const res = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Create Booking Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data) {
      // Handle array response
      let bookingId = null;
      let status = 'Request';
      
      if (res.data.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        // Get the first booking's ID (or you could return all IDs)
        bookingId = res.data.data[0].booking_id;
        status = res.data.data[0].status;
      } else if (res.data.booking_id) {
        bookingId = res.data.booking_id;
        status = res.data.status;
      } else if (res.data.data && res.data.data.booking_id) {
        bookingId = res.data.data.booking_id;
        status = res.data.data.status;
      }
      
      return { 
        success: true, 
        bookingId: bookingId,
        status: status,
        message: res.data.message || 'Booking created successfully',
        bookingCount: Array.isArray(res.data.data) ? res.data.data.length : 1
      };
    } else {
      return { success: false, error: 'Failed to create booking' };
    }
  } catch (err) {
    console.log('=== Create Booking Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      
      // Extract user-friendly error message from the detail object
      let errorMessage = 'Failed to create booking';
      
      if (err.response.data) {
        const data = err.response.data;
        
        // Check for nested detail object (your API structure)
        if (data.detail && typeof data.detail.message === 'string') {
          errorMessage = data.detail.message;
        }
        // Fallback to other common error message fields
        else if (typeof data.message === 'string') {
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

export async function cancelBooking(bookingId) {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const url = `${BASE_URL}${API_ENDPOINTS.CANCEL_BOOKING}/${bookingId}`;
    
    console.log('=== Cancelling Booking ===');
    console.log('URL:', url);
    console.log('Booking ID:', bookingId);
    
    const res = await axios.patch(url, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });
    
    console.log('Cancel Booking Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data) {
      return { 
        success: true, 
        message: res.data.message || 'Booking cancelled successfully',
        data: res.data.data
      };
    } else {
      return { success: false, error: 'Failed to cancel booking' };
    }
  } catch (err) {
    console.log('=== Cancel Booking Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      
      let errorMessage = 'Failed to cancel booking';
      
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

export async function getBookingDetails(bookingId) {
  try {
    const token = await AsyncStorage.getItem('access_token');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const url = `${BASE_URL}${API_ENDPOINTS.BOOKING_DETAILS}/${bookingId}`;
    
    console.log('=== Fetching Booking Details ===');
    console.log('URL:', url);
    console.log('Booking ID:', bookingId);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });
    
    console.log('Booking Details Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.data) {
      return { 
        success: true, 
        booking: res.data.data,
        message: res.data.message
      };
    } else {
      return { success: false, error: 'Booking not found' };
    }
  } catch (err) {
    console.log('=== Booking Details Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      
      let errorMessage = 'Failed to fetch booking details';
      
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
