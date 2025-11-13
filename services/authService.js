import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';

export async function login({ tenantId, username, password }) {
  try {
    const loginUrl = `${BASE_URL}${API_ENDPOINTS.LOGIN}`;
    
    console.log('=== Login Request ===');
    console.log('Tenant ID:', tenantId);
    console.log('Username:', username);
    console.log('API URL:', loginUrl);
    
    const payload = {
      tenant_id: tenantId,
      username,
      password,
    };
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    const res = await axios.post(loginUrl, payload);
    
    console.log('=== Login Response ===');
    console.log('Status:', res.status);
    console.log('Response data:', JSON.stringify(res.data, null, 2));
    
    const accessToken = res?.data?.data?.access_token;
    if (accessToken) {
      console.log('✓ Access token received');
      // Store additional user data
      const userData = res?.data?.data;
      const employeeId = userData?.user?.employee?.employee_id;
      
      console.log('Employee ID:', employeeId);
      console.log('User data:', JSON.stringify(userData?.user?.employee, null, 2));
      
      return { 
        success: true, 
        access_token: accessToken,
        employee_id: employeeId,
        tenant_id: tenantId,
        user_data: userData
      };
    } else {
      console.log('✗ Token missing in response');
      console.log('Full response structure:', JSON.stringify(res.data, null, 2));
      return { success: false, error: 'Token missing in response.' };
    }
  } catch (err) {
    console.log('=== Login Error ===');
    console.log('Error message:', err.message);
    console.log('Error code:', err.code);
    
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      console.log('Response headers:', JSON.stringify(err.response.headers, null, 2));
      
      // Extract user-friendly error message from the detail object
      let errorMessage = 'Login failed. Please try again.';
      
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
        } else {
          errorMessage = `Server error: ${err.response.status}`;
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    } else if (err.request) {
      console.log('Request made but no response received');
      console.log('Request:', err.request);
      return { success: false, error: 'Server is down or unreachable. Please try again later.' };
    } else {
      console.log('Error setting up request:', err.message);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }
}