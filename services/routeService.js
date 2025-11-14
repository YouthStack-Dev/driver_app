import api from './apiClient';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';

export async function getDriverTrips({ statusFilter = 'upcoming', bookingDate = null }) {
  try {
    // token and Authorization header are attached automatically by `apiClient`

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
    console.log('Booking Date (sent to API):', dateParam);
    console.log('Current Device Time:', new Date().toLocaleString());
    console.log('Current Device Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    console.log('Timezone Offset:', new Date().getTimezoneOffset(), 'minutes');
    
    const res = await api.get(url);
    
    console.log('Driver Trips Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.success && res.data.data) {
      const routes = res.data.data.routes || [];
      const count = res.data.data.count || 0;
      
      console.log('Routes fetched:', count);
      console.log('API Message:', res.data.message);
      
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
