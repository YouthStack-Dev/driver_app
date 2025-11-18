import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import locationPermissionService from '../services/locationPermissionService';
import { Linking } from 'react-native';

const LocationPermissionGuard = ({ children }) => {
  const [permissionStatus, setPermissionStatus] = useState({
    checking: true,
    granted: false,
    canRequest: true,
    error: null
  });

  useEffect(() => {
    initializeLocationPermissions();
  }, []);

  const initializeLocationPermissions = async () => {
    try {
      console.log('Initializing location permissions on app start...');
      
      // Check current status first
      const currentStatus = await locationPermissionService.getCurrentPermissionStatus();
      
      if (currentStatus.hasAll) {
        console.log('Location permissions already granted');
        setPermissionStatus({
          checking: false,
          granted: true,
          canRequest: true,
          error: null
        });
        return;
      }
      
      // Request permissions if not granted
      console.log('Requesting location permissions...');
      const result = await locationPermissionService.checkAndRequestPermissions(true);
      
      if (result.success) {
        setPermissionStatus({
          checking: false,
          granted: true,
          canRequest: true,
          error: null
        });
      } else {
        // Check if we can ask again
        const finalStatus = await locationPermissionService.getCurrentPermissionStatus();
        
        setPermissionStatus({
          checking: false,
          granted: false,
          canRequest: finalStatus.foreground.canAskAgain || finalStatus.background.canAskAgain,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('Error initializing location permissions:', error);
      setPermissionStatus({
        checking: false,
        granted: false,
        canRequest: true,
        error: error.message
      });
    }
  };

  const handleRequestPermissions = async () => {
    setPermissionStatus(prev => ({ ...prev, checking: true }));
    await initializeLocationPermissions();
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  // Show loading while checking permissions
  if (permissionStatus.checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.title}>Checking Location Permissions...</Text>
        <Text style={styles.subtitle}>Please wait while we verify location access</Text>
      </View>
    );
  }

  // Show permission required screen if not granted
  if (!permissionStatus.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📍</Text>
        </View>
        
        <Text style={styles.title}>Location Access Required</Text>
        
        <Text style={styles.description}>
          This app requires location access to track driver position, provide real-time updates, optimize route planning, and ensure passenger safety.
        </Text>
        
        {permissionStatus.error && (
          <Text style={styles.error}>
            {permissionStatus.error}
          </Text>
        )}
        
        <View style={styles.buttonContainer}>
          {permissionStatus.canRequest ? (
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleRequestPermissions}
            >
              <Text style={styles.primaryButtonText}>Grant Location Access</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleOpenSettings}
            >
              <Text style={styles.primaryButtonText}>Open App Settings</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.helpText}>
            {permissionStatus.canRequest 
              ? 'Tap to grant location permissions'
              : 'Please enable location access in app settings'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => {
            Alert.alert(
              'Location Required',
              'Location access is mandatory for this app to function properly.',
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={styles.secondaryButtonText}>Why is this required?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permissions granted - render children
  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
  },
  error: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
});

export default LocationPermissionGuard;