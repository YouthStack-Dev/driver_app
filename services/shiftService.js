import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getActiveShifts() {
  try {
    const token = await AsyncStorage.getItem('access_token');
    const tenantId = await AsyncStorage.getItem('tenant_id');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    if (!tenantId) {
      return { success: false, error: 'Tenant ID not found' };
    }

    const url = `${BASE_URL}${API_ENDPOINTS.SHIFTS}/?skip=0&limit=100&is_active=true&tenant_id=${tenantId}`;
    
    console.log('=== Fetching Active Shifts ===');
    console.log('URL:', url);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Shifts Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data) {
      // Handle different possible response structures
      let shifts = [];
      
      if (Array.isArray(res.data)) {
        shifts = res.data;
      } else if (res.data.data && Array.isArray(res.data.data.items)) {
        // API returns items array inside data
        shifts = res.data.data.items;
      } else if (res.data.data && Array.isArray(res.data.data)) {
        shifts = res.data.data;
      } else if (res.data.data && Array.isArray(res.data.data.shifts)) {
        shifts = res.data.data.shifts;
      } else if (res.data.shifts && Array.isArray(res.data.shifts)) {
        shifts = res.data.shifts;
      } else if (res.data.items && Array.isArray(res.data.items)) {
        shifts = res.data.items;
      }
      
      console.log('Parsed shifts array:', shifts);
      console.log('Number of shifts:', shifts.length);
      
      // Separate shifts by log_type
      const inShifts = shifts.filter(s => s && s.log_type === 'IN');
      const outShifts = shifts.filter(s => s && s.log_type === 'OUT');
      
      console.log('IN shifts:', inShifts.length);
      console.log('OUT shifts:', outShifts.length);
      
      return { 
        success: true, 
        shifts: {
          in: inShifts,
          out: outShifts,
          all: shifts
        }
      };
    } else {
      return { success: true, shifts: { in: [], out: [], all: [] } };
    }
  } catch (err) {
    console.log('=== Shifts Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      const errorMessage = err.response.data?.detail?.message 
        || err.response.data?.message 
        || 'Failed to fetch shifts';
      return { success: false, error: errorMessage };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}
