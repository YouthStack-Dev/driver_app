import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocation } from '../context/LocationContext';

const LocationTracker = ({ style, showDetails = true }) => {
  const {
    isTracking,
    lastKnownLocation,
    locationError,
    startTracking,
    stopTracking,
    manualUpdate,
    getCurrentLocation,
    clearError,
  } = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  useEffect(() => {
    if (lastKnownLocation) {
      setLastUpdateTime(new Date().toLocaleTimeString());
    }
  }, [lastKnownLocation]);

  const handleToggleTracking = async () => {
    try {
      setIsLoading(true);
      clearError();

      if (isTracking) {
        const result = await stopTracking();
        if (result.success) {
          Alert.alert('Success', 'Location tracking stopped');
        } else {
          Alert.alert('Error', result.error || 'Failed to stop tracking');
        }
      } else {
        const result = await startTracking();
        if (result.success) {
          Alert.alert('Success', 'Location tracking started');
        } else {
          Alert.alert('Error', result.error || 'Failed to start tracking');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUpdate = async () => {
    try {
      setIsLoading(true);
      clearError();

      const result = await manualUpdate();
      if (result.success) {
        Alert.alert('Success', 'Location updated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to update location');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    try {
      setIsLoading(true);
      clearError();

      const result = await getCurrentLocation();
      if (result.success) {
        const { latitude, longitude } = result.location;
        Alert.alert(
          'Current Location',
          `Lat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to get location');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Location Tracking</Text>
        <View style={[styles.status, isTracking ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, isTracking ? styles.statusTextActive : styles.statusTextInactive]}>
            {isTracking ? '🟢 Active' : '🔴 Inactive'}
          </Text>
        </View>
      </View>

      {/* Error Display */}
      {locationError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {locationError}</Text>
          <TouchableOpacity onPress={clearError} style={styles.clearErrorButton}>
            <Text style={styles.clearErrorText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location Details */}
      {showDetails && lastKnownLocation && (
        <View style={styles.locationDetails}>
          <Text style={styles.locationTitle}>📍 Last Known Location</Text>
          <Text style={styles.locationText}>
            Lat: {lastKnownLocation.latitude?.toFixed(6) || 'N/A'}
          </Text>
          <Text style={styles.locationText}>
            Lon: {lastKnownLocation.longitude?.toFixed(6) || 'N/A'}
          </Text>
          <Text style={styles.methodText}>
            📡 Method: HTTP Fallback (Reliable)
          </Text>
          {lastUpdateTime && (
            <Text style={styles.updateTime}>
              Updated: {lastUpdateTime}
            </Text>
          )}
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleToggleTracking}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleManualUpdate}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Update Now</Text>
        </TouchableOpacity>

        {showDetails && (
          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={handleGetCurrentLocation}
            disabled={isLoading}
          >
            <Text style={styles.tertiaryButtonText}>Get Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#343a40',
  },
  status: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusActive: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  statusInactive: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#155724',
  },
  statusTextInactive: {
    color: '#721c24',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    flex: 1,
  },
  clearErrorButton: {
    padding: 4,
  },
  clearErrorText: {
    color: '#721c24',
    fontWeight: 'bold',
    fontSize: 16,
  },
  locationDetails: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  methodText: {
    fontSize: 11,
    color: '#28a745',
    marginTop: 4,
    fontWeight: '500',
  },
  updateTime: {
    fontSize: 11,
    color: '#868e96',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderColor: '#007bff',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: 'white',
    borderColor: '#6c757d',
    borderWidth: 1,
  },
  tertiaryButtonText: {
    color: '#6c757d',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LocationTracker;