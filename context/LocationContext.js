import React, { createContext, useContext, useState, useEffect } from 'react';
import locationService from '../services/locationService';

const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [lastKnownLocation, setLastKnownLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);

  useEffect(() => {
    // Check initial tracking status
    const status = locationService.getTrackingStatus();
    setIsTracking(status.isTracking);
    setLastKnownLocation(status.lastKnownLocation);
  }, []);

  const startTracking = async () => {
    try {
      setLocationError(null);
      const result = await locationService.startLocationTracking();
      
      if (result.success) {
        setIsTracking(true);
        console.log('✅ Location tracking started from context');
      } else {
        setLocationError(result.error);
        console.log('❌ Failed to start tracking:', result.error);
      }
      
      return result;
    } catch (error) {
      setLocationError(error.message);
      console.error('❌ Context start tracking error:', error);
      return { success: false, error: error.message };
    }
  };

  const stopTracking = async () => {
    try {
      const result = await locationService.stopLocationTracking();
      
      if (result.success) {
        setIsTracking(false);
        console.log('✅ Location tracking stopped from context');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Context stop tracking error:', error);
      return { success: false, error: error.message };
    }
  };

  const manualUpdate = async () => {
    try {
      setLocationError(null);
      const result = await locationService.manualLocationUpdate();
      
      if (result.success) {
        // Update last known location
        const status = locationService.getTrackingStatus();
        setLastKnownLocation(status.lastKnownLocation);
      } else {
        setLocationError(result.error);
      }
      
      return result;
    } catch (error) {
      setLocationError(error.message);
      return { success: false, error: error.message };
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationError(null);
      const result = await locationService.getCurrentLocation();
      
      if (result.success) {
        setLastKnownLocation(result.location);
      } else {
        setLocationError(result.error);
      }
      
      return result;
    } catch (error) {
      setLocationError(error.message);
      return { success: false, error: error.message };
    }
  };

  const requestPermissions = async () => {
    try {
      const result = await locationService.requestLocationPermissions();
      setPermissionStatus(result);
      return result;
    } catch (error) {
      console.error('❌ Permission request error:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    // State
    isTracking,
    lastKnownLocation,
    locationError,
    permissionStatus,
    
    // Actions
    startTracking,
    stopTracking,
    manualUpdate,
    getCurrentLocation,
    requestPermissions,
    
    // Utils
    clearError: () => setLocationError(null),
    getTrackingStatus: () => locationService.getTrackingStatus(),
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};