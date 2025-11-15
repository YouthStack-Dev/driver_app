import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationService from '../navigation/NavigationService';

const SESSION_KEY = 'user_session';
const TEMP_SESSION_KEY = 'temp_login_session';

let expiryTimeout = null;

function base64UrlDecode(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // try atob (browser/React Native) first
    if (typeof atob === 'function') {
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
    }
    // try Buffer (node)
    if (typeof Buffer === 'function') {
      return Buffer.from(base64, 'base64').toString('utf8');
    }
  } catch (e) {
    return null;
  }
  return null;
}

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = base64UrlDecode(payload);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

async function setSession({ access_token, user_data }) {
  if (!access_token) return;
  const payload = decodeJwt(access_token);
  const expiresAt = payload && payload.exp ? payload.exp * 1000 : null; // ms

  const session = {
    access_token,
    user_data: user_data || null,
    expiresAt,
  };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  scheduleExpiryCheck(session);
}

async function setTempSession({ temp_token, driver, accounts }) {
  if (!temp_token) return;
  const session = {
    temp_token,
    driver: driver || null,
    accounts: accounts || [],
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(session));
}

async function getTempSession() {
  const raw = await AsyncStorage.getItem(TEMP_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function clearTempSession() {
  await AsyncStorage.removeItem(TEMP_SESSION_KEY);
}

async function setTempSelection(account) {
  // persist selected account on temp session so the app can continue
  const s = await getTempSession();
  if (!s) throw new Error('No temp session');
  const updated = { ...s, selected_account: account };
  await AsyncStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(updated));
}

async function getSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function clearSession() {
  if (expiryTimeout) {
    clearTimeout(expiryTimeout);
    expiryTimeout = null;
  }
  await AsyncStorage.removeItem(SESSION_KEY);
}

function scheduleExpiryCheck(session) {
  if (expiryTimeout) {
    clearTimeout(expiryTimeout);
    expiryTimeout = null;
  }

  if (!session || !session.expiresAt) return;

  const now = Date.now();
  const ms = session.expiresAt - now;
  if (ms <= 0) {
    // already expired
    handleSessionExpired();
    return;
  }

  // set timeout a little before expiration to be safe
  const timeoutMs = Math.max(1000, ms);
  expiryTimeout = setTimeout(() => {
    handleSessionExpired();
  }, timeoutMs);
}

function handleSessionExpired() {
  // clear storage and navigate to Login
  clearSession().then(() => {
    NavigationService.resetToLogin();
  });
}

async function init() {
  const session = await getSession();
  if (session) scheduleExpiryCheck(session);
}

export default {
  setSession,
  getSession,
  clearSession,
  init,
  setTempSession,
  getTempSession,
  clearTempSession,
  setTempSelection,
};
