import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getWeekoffConfig() {
  try {
    const token = await AsyncStorage.getItem('access_token');
    const employeeId = await AsyncStorage.getItem('employee_id');
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    if (!employeeId) {
      return { success: false, error: 'Employee ID not found. Please login again.' };
    }

    const url = `${BASE_URL}${API_ENDPOINTS.WEEKOFF_CONFIG}/${employeeId}`;
    
    console.log('=== Fetching Weekoff Config ===');
    console.log('URL:', url);
    console.log('Employee ID:', employeeId);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Weekoff Config Response:', JSON.stringify(res.data, null, 2));
    
    if (res.data && res.data.data && res.data.data.weekoff_config) {
      const config = res.data.data.weekoff_config;
      
      // Convert boolean fields to array of weekoff day names
      const weekoffDays = [];
      if (config.sunday) weekoffDays.push('SUNDAY');
      if (config.monday) weekoffDays.push('MONDAY');
      if (config.tuesday) weekoffDays.push('TUESDAY');
      if (config.wednesday) weekoffDays.push('WEDNESDAY');
      if (config.thursday) weekoffDays.push('THURSDAY');
      if (config.friday) weekoffDays.push('FRIDAY');
      if (config.saturday) weekoffDays.push('SATURDAY');
      
      console.log('Parsed weekoff days:', weekoffDays);
      
      return { success: true, weekoffDays };
    } else {
      return { success: true, weekoffDays: [] };
    }
  } catch (err) {
    console.log('=== Weekoff Config Error ===');
    console.log('Error:', err.message);
    
    if (err.response) {
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      const errorMessage = err.response.data?.detail?.message 
        || err.response.data?.message 
        || 'Failed to fetch weekoff configuration';
      return { success: false, error: errorMessage };
    }
    
    return { success: false, error: 'Network error. Please try again.' };
  }
}
