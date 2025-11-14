import axios from 'axios';
import sessionService from './sessionService';
import NavigationService from '../navigation/NavigationService';
import { BASE_URL } from '../constants/config';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// attach token to every request
api.interceptors.request.use(async (config) => {
  try {
    const session = await sessionService.getSession();
    if (session && session.access_token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// handle 401/403 -> clear session and redirect
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      await sessionService.clearSession();
      NavigationService.resetToLogin();
    }
    return Promise.reject(err);
  }
);

export default api;
