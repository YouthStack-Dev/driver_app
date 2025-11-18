import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import locationPermissionService from '../services/locationPermissionService';
import locationService from '../services/locationService';
import { Linking } from 'react-native';

const LocationStatusCard = () => {
  const [permissionStatus, setPermissionStatus] = useState({
    checking: true,
    foreground: { granted: false, status: 'unknown' },
    background: { granted: false, status: 'unknown' },
    hasAll: false
  });
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    checkPermissionStatus();
    checkTrackingStatus();
    
    // Set up permission monitoring
    locationService.setPermissionLostCallback((status) => {
      setPermissionStatus(status);
      setIsTracking(false);
    });
    
    // Periodic status check
    const interval = setInterval(() => {
      checkPermissionStatus();
      checkTrackingStatus();
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const status = await locationPermissionService.getCurrentPermissionStatus();
      setPermissionStatus({ ...status, checking: false });
    } catch (error) {
      console.error('Error checking permission status:', error);
      setPermissionStatus(prev => ({ ...prev, checking: false }));
    }
  };

  const checkTrackingStatus = () => {
    setIsTracking(locationService.isTracking);
    if (locationService.lastKnownLocation) {
      setLastUpdate(new Date(locationService.lastKnownLocation.timestamp));
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const result = await locationPermissionService.checkAndRequestPermissions(true);
      if (result.success) {
        await checkPermissionStatus();
        Alert.alert('Success', 'Location permissions granted successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request permissions: ' + error.message);
    }
  };

  const handleToggleTracking = async () => {
    try {
      if (isTracking) {
        const result = await locationService.stopLocationTracking();
        if (result.success) {
          setIsTracking(false);
          Alert.alert('Success', 'Location tracking stopped');
        }
      } else {
        const result = await locationService.startLocationTracking();
        if (result.success) {
          setIsTracking(true);
          Alert.alert('Success', 'Location tracking started');
        } else {
          Alert.alert('Error', result.error || 'Failed to start tracking');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle tracking: ' + error.message);
    }
  };

  const getPermissionStatusColor = (granted) => {
    return granted ? '#4CAF50' : '#FF5722';
  };

  const getPermissionStatusText = (granted) => {
    return granted ? 'Granted' : 'Denied';
  };

  const getTrackingStatusColor = () => {
    return isTracking ? '#4CAF50' : '#FF9800';
  };

  if (permissionStatus.checking) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Location Status</Text>
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Location Status</Text>
      
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Foreground:</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getPermissionStatusColor(permissionStatus.foreground.granted) }
          ]}>
            <Text style={styles.statusBadgeText}>
              {getPermissionStatusText(permissionStatus.foreground.granted)}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Background:</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getPermissionStatusColor(permissionStatus.background.granted) }
          ]}>
            <Text style={styles.statusBadgeText}>
              {getPermissionStatusText(permissionStatus.background.granted)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>Tracking</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getTrackingStatusColor() }
          ]}>
            <Text style={styles.statusBadgeText}>
              {isTracking ? 'Active' : 'Stopped'}
            </Text>
          </View>
        </View>
        
        {lastUpdate && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Update:</Text>
            <Text style={styles.statusValue}>
              {lastUpdate.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.buttonSection}>
        {!permissionStatus.hasAll && (
          <TouchableOpacity 
            style={[styles.button, styles.permissionButton]} 
            onPress={handleRequestPermissions}
          >
            <Text style={styles.buttonText}>Grant Permissions</Text>
          </TouchableOpacity>
        )}
        
        {!permissionStatus.hasAll && (
          <TouchableOpacity 
            style={[styles.button, styles.settingsButton]} 
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        
        {permissionStatus.foreground.granted && (
          <TouchableOpacity 
            style={[
              styles.button, 
              isTracking ? styles.stopButton : styles.startButton
            ]} 
            onPress={handleToggleTracking}
          >
            <Text style={styles.buttonText}>
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {!permissionStatus.hasAll && (
        <Text style={styles.warningText}>
          Location permissions are required for proper app functionality
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  statusSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonSection: {
    marginTop: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  permissionButton: {
    backgroundColor: '#2196F3',
  },
  settingsButton: {
    backgroundColor: '#FF9800',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#FF5722',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default LocationStatusCard;