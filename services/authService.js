import axios from 'axios';
import { BASE_URL, API_ENDPOINTS } from '../constants/config';
import sessionService from './sessionService';
import locationService from './locationService';

export async function login({ license_number, password, authToken } = {}) {
  try {
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
    
    const data = res?.data?.data || {};
    const tempToken = data?.temp_token || data?.token || null;
    const accounts = data?.accounts || [];
    const driver = data?.driver || null;

    if (tempToken) {
      console.log(' Temp token received');
      try {
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

    console.log(' Temp token missing in response');
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
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.response.data) {
        const data = err.response.data;
        
        if (data.detail && typeof data.detail.message === 'string') {
          errorMessage = data.detail.message;
        }
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
        console.log(' Access token received from confirm');
        try {
          // Merge accounts from temp session into final user_data
          const tempSession = await sessionService.getTempSession();
          const accounts = tempSession?.accounts || [];
          
          const finalUserData = {
            ...data,
            accounts: accounts, // Add accounts list to session
          };
          
          await sessionService.setSession({ access_token: accessToken, user_data: finalUserData });
          await sessionService.clearTempSession();
          
          // Start location tracking after successful login
          console.log('🚀 Starting location tracking after login...');
          setTimeout(async () => {
            try {
              const trackingResult = await locationService.startLocationTracking();
              if (trackingResult.success) {
                console.log('✅ Location tracking started automatically');
              } else {
                console.log('⚠️ Could not start location tracking:', trackingResult.error);
              }
            } catch (error) {
              console.log('⚠️ Location tracking start error:', error.message);
            }
          }, 2000); // Wait 2 seconds after login
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
      const resp = err?.response;
      const serverData = resp?.data || {};
      const errorCode = serverData?.code || serverData?.error_code || serverData?.detail?.code || null;
      const errorMessage = (serverData && (serverData.message || serverData.error || serverData.detail)) || err.message || 'Confirm login failed.';

      if (attempt > retries) {
        return { success: false, error: errorMessage, errorCode };
      }

      const status = resp?.status || 0;
      const isRetryable = !resp || status >= 500 || status === 0;
      if (!isRetryable) {
        return { success: false, error: errorMessage, errorCode };
      }

      const backoffMs = 300 * Math.pow(2, attempt - 1);
      console.log(`Confirm login attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }
  }

  return { success: false, error: lastError?.message || 'Confirm login failed.' };
}

export async function switchCompany({ access_token, vendor_id, tenant_id } = {}) {
  try {
    const url = `${BASE_URL}${API_ENDPOINTS.SWITCH_COMPANY}`;
    
    console.log('=== Switch Company Request ===');
    console.log('URL:', url);
    console.log('Vendor ID:', vendor_id);
    console.log('Tenant ID:', tenant_id);
    
    const payload = {
      vendor_id,
      tenant_id,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    };

    const res = await axios.post(url, payload, { headers });
    
    console.log('=== Switch Company Response ===');
    console.log('Status:', res.status);
    console.log('Response data:', JSON.stringify(res.data, null, 2));
    
    const data = res?.data?.data || {};
    const newAccessToken = data?.access_token || data?.token || null;

    if (newAccessToken) {
      console.log(' New access token received after switch');
      try {
        // Preserve accounts list from previous session
        const currentSession = await sessionService.getSession();
        const accounts = currentSession?.user_data?.accounts || [];
        
        const finalUserData = {
          ...data,
          accounts: accounts, // Preserve accounts list across switches
        };
        
        await sessionService.setSession({ 
          access_token: newAccessToken, 
          user_data: finalUserData 
        });
        
        // Start location tracking after successful company switch
        console.log('🚀 Starting location tracking after company switch...');
        setTimeout(async () => {
          try {
            const trackingResult = await locationService.startLocationTracking();
            if (trackingResult.success) {
              console.log('✅ Location tracking started after company switch');
            } else {
              console.log('⚠️ Could not start location tracking:', trackingResult.error);
            }
          } catch (error) {
            console.log('⚠️ Location tracking start error:', error.message);
          }
        }, 1000); // Wait 1 second after switch
      } catch (e) {
        console.log('Error saving switched session:', e?.message || e);
      }

      return {
        success: true,
        access_token: newAccessToken,
        user_data: data,
      };
    }

    return { success: false, error: 'New access token missing in switch response.' };
  } catch (err) {
    console.log('=== Switch Company Error ===');
    console.log('Error message:', err.message);
    
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
      
      let errorMessage = 'Failed to switch company. Please try again.';
      
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
    
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}