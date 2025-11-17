import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';
import sessionService from './sessionService';

export async function login({ license_number, password, authToken } = {}) {
  try {
    // New backend expects license_number + password at /api/v1/auth/driver/new/login
    const loginUrl = `${BASE_URL}${API_ENDPOINTS.NEW_LOGIN}`;
    
    console.log('=== Driver Login Request ===');
    console.log('License number:', license_number);
    console.log('API URL:', loginUrl);
    
    const payload = {
      license_number: license_number,
      password,
    };
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await axios.post(loginUrl, payload, { headers });
    
    console.log('=== Driver Login Response ===');
    console.log('Status:', res.status);
    console.log('Response data:', JSON.stringify(res.data, null, 2));
    
    // New flow: backend returns a temporary token and list of accounts
    const data = res?.data?.data || {};
    const tempToken = data?.temp_token || data?.token || null;
    const accounts = data?.accounts || [];
    const driver = data?.driver || null;

    if (tempToken) {
      console.log('âœ“ Temp token received');
      try {
        // store temp-session separately; final access token will be obtained after account selection
        await sessionService.setTempSession({ temp_token: tempToken, driver, accounts });
      } catch (e) {
        console.log('Error saving temp session:', e?.message || e);
      }

      return {
        success: true,
        temp_token: tempToken,
        accounts,
        driver,
      };
    }

    console.log('âœ— Temp token missing in response');
    console.log('Full response structure:', JSON.stringify(res.data, null, 2));
    return { success: false, error: 'Token missing in response.' };
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

export async function confirmLogin({ temp_token, vendor_id, tenant_id, authToken, retries = 2 } = {}) {
  const url = `${BASE_URL}${API_ENDPOINTS.LOGIN_CONFIRM}`;
  const payload = { temp_token, vendor_id, tenant_id };

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      console.log('=== Confirm Login Request ===', { attempt });
      console.log('URL:', url);
      console.log('Payload:', payload);

      const res = await axios.post(url, payload, { headers });

      console.log('=== Confirm Login Response ===');
      console.log('Status:', res.status);
      console.log('Response data:', JSON.stringify(res.data, null, 2));

      const data = res?.data?.data || {};
      const accessToken = data?.access_token || data?.token || null;

      if (accessToken) {
        console.log('âœ“ Access token received from confirm');
        try {
          await sessionService.setSession({ access_token: accessToken, user_data: data });
          await sessionService.clearTempSession();
        } catch (e) {
          console.log('Error saving final session:', e?.message || e);
        }

        return {
          success: true,
          access_token: accessToken,
          user_data: data,
        };
      }

      return { success: false, error: 'Confirm: access token missing in response.' };
    } catch (err) {
      attempt += 1;
      lastError = err;
      // extract server error code/message if present
      const resp = err?.response;
      const serverData = resp?.data || {};
      const errorCode = serverData?.code || serverData?.error_code || serverData?.detail?.code || null;
      const errorMessage = (serverData && (serverData.message || serverData.error || serverData.detail)) || err.message || 'Confirm login failed.';

      // If we've exhausted attempts, return the extracted error
      if (attempt > retries) {
        return { success: false, error: errorMessage, errorCode };
      }

      // Retry on network errors or 5xx responses
      const status = resp?.status || 0;
      const isRetryable = !resp || status >= 500 || status === 0;
      if (!isRetryable) {
        return { success: false, error: errorMessage, errorCode };
      }

      // exponential backoff before retrying
      const backoffMs = 300 * Math.pow(2, attempt - 1);
      console.log(`Confirm login attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }
  }

  // fallback
  return { success: false, error: lastError?.message || 'Confirm login failed.' };
}
