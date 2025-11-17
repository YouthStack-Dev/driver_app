export const BASE_URL = 'https://api.gocab.tech';
export const API_ENDPOINTS = {
  LOGIN: '/api/v1/auth/driver/login',
  NEW_LOGIN: '/api/v1/auth/driver/new/login',
  LOGIN_CONFIRM: '/api/v1/auth/driver/login/confirm',
  SWITCH_COMPANY: '/api/v1/auth/driver/switch-company',
  DRIVER_TRIPS: '/api/v1/driver/trips',
  BOOKINGS: '/api/v1/bookings/employee',
  BOOKING_DETAILS: '/api/v1/bookings', // Will be used as /api/v1/bookings/{booking_id}
  WEEKOFF_CONFIG: '/api/v1/weekoff-configs',
  SHIFTS: '/api/v1/shifts',
  CREATE_BOOKING: '/api/v1/bookings',
  CANCEL_BOOKING: '/api/v1/bookings/cancel', // Will be used as /api/v1/bookings/cancel/{booking_id}
};
