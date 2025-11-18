import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import firebaseService from '../services/firebaseService';
import httpFirebaseService from '../services/httpFirebaseService';
import locationService from '../services/locationService';
import sessionService from '../services/sessionService';
import { useLocation } from '../context/LocationContext';

const LocationTestScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTestResult, setLastTestResult] = useState(null);
  const { lastKnownLocation, isTracking } = useLocation();

  const testFirebaseConnection = async () => {
    try {
      setIsLoading(true);
      
      // Test data
      const testData = {
        driver_id: 'TEST_DRIVER_001',
        latitude: 12.9734,
        longitude: 77.614,
        test: true,
        test_time: new Date().toISOString(),
      };

      console.log('🧪 Testing Firebase SDK connection...');
      
      let result = await firebaseService.updateDriverLocation(
        'TEST_TENANT', 
        'TEST_VENDOR', 
        'TEST_DRIVER_001',
        testData.latitude,
        testData.longitude,
        { test: true, test_time: testData.test_time }
      );

      // If SDK fails, try HTTP fallback
      if (!result.success) {
        console.log('🔄 SDK failed, trying HTTP Firebase...');
        result = await httpFirebaseService.updateDriverLocation(
          'TEST_TENANT', 
          'TEST_VENDOR', 
          'TEST_DRIVER_001',
          testData.latitude,
          testData.longitude,
          { test: true, test_time: testData.test_time, fallback: 'http' }
        );
      }

      if (result.success) {
        Alert.alert('✅ Success', 'Firebase connection test passed!');
        setLastTestResult('Firebase connection: ✅ PASS');
      } else {
        Alert.alert('❌ Failed', `Firebase test failed: ${result.error}`);
        setLastTestResult(`Firebase connection: ❌ FAIL - ${result.error}`);
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
      setLastTestResult(`Firebase connection: ❌ ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLocationService = async () => {
    try {
      setIsLoading(true);
      
      console.log('🧪 Testing location service...');
      
      const result = await locationService.getCurrentLocation();

      if (result.success) {
        const { latitude, longitude, accuracy } = result.location;
        Alert.alert(
          '✅ Location Test Passed', 
          `Lat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}\nAccuracy: ${accuracy?.toFixed(1)}m`
        );
        setLastTestResult(`Location service: ✅ PASS - Accuracy: ${accuracy?.toFixed(1)}m`);
      } else {
        Alert.alert('❌ Failed', `Location test failed: ${result.error}`);
        setLastTestResult(`Location service: ❌ FAIL - ${result.error}`);
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
      setLastTestResult(`Location service: ❌ ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFullIntegration = async () => {
    try {
      setIsLoading(true);
      
      console.log('🧪 Testing full integration...');
      
      // Test manual location update
      const result = await locationService.manualLocationUpdate();

      if (result.success) {
        Alert.alert('✅ Integration Test Passed', 'Location successfully updated to Firebase!');
        setLastTestResult('Full integration: ✅ PASS');
      } else {
        Alert.alert('❌ Failed', `Integration test failed: ${result.error}`);
        setLastTestResult(`Full integration: ❌ FAIL - ${result.error}`);
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
      setLastTestResult(`Full integration: ❌ ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFirebaseUrl = async () => {
    try {
      setIsLoading(true);
      
      console.log('🧪 Testing Firebase URL accessibility...');
      
      const testUrl = 'https://ets-1-ccb71-default-rtdb.firebaseio.com/test.json';
      
      const response = await fetch(testUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('✅ URL Test Passed', `Firebase URL is accessible!\nResponse: ${JSON.stringify(result)}`);
        setLastTestResult('Firebase URL: ✅ ACCESSIBLE');
      } else {
        Alert.alert('❌ URL Test Failed', `Status: ${response.status} ${response.statusText}`);
        setLastTestResult(`Firebase URL: ❌ STATUS ${response.status}`);
      }
    } catch (error) {
      Alert.alert('❌ URL Error', `Network error: ${error.message}`);
      setLastTestResult(`Firebase URL: ❌ NETWORK ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testSessionData = async () => {
    try {
      setIsLoading(true);
      
      console.log('🧪 Testing session data...');
      
      const session = await sessionService.getSession();
      
      if (!session) {
        Alert.alert('❌ No Session', 'No user session found. Please login first.');
        setLastTestResult('Session data: ❌ NO SESSION');
        return;
      }

      const userData = session.user_data;
      
      // Try to extract IDs
      const driverId = userData.driver_id || 
                      (userData.user && userData.user.driver && userData.user.driver.driver_id) || 
                      (userData.user && userData.user.driver_id) || 
                      (userData.driver && userData.driver.driver_id) ||
                      userData.id;
                      
      const vendorId = userData.vendor_id || 
                      (userData.account && userData.account.vendor_id) || 
                      (userData.user && userData.user.driver && userData.user.driver.vendor_id) ||
                      (userData.vendor && userData.vendor.id);
                      
      const tenantId = userData.tenant_id || 
                      (userData.account && userData.account.tenant_id) || 
                      (userData.user && userData.user.tenant_id) || 
                      (userData.user && userData.user.driver && userData.user.driver.tenant_id) ||
                      (userData.tenant && userData.tenant.id);

      const debugInfo = {
        'Driver ID': driverId || 'NOT FOUND',
        'Vendor ID': vendorId || 'NOT FOUND', 
        'Tenant ID': tenantId || 'NOT FOUND',
        'User Data Keys': Object.keys(userData || {}),
        'Session Keys': Object.keys(session || {})
      };

      Alert.alert(
        '🔍 Session Debug Info',
        JSON.stringify(debugInfo, null, 2),
        [
          { text: 'Show Raw Data', onPress: () => {
            Alert.alert('Raw Session Data', JSON.stringify(session, null, 2));
          }},
          { text: 'Close', style: 'cancel' }
        ]
      );
      
      if (driverId && vendorId && tenantId) {
        setLastTestResult('Session data: ✅ ALL IDs FOUND');
      } else {
        setLastTestResult(`Session data: ❌ MISSING IDs - D:${!!driverId} V:${!!vendorId} T:${!!tenantId}`);
      }
      
    } catch (error) {
      Alert.alert('❌ Debug Error', error.message);
      setLastTestResult(`Session debug: ❌ ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFirebaseRead = async () => {
    try {
      setIsLoading(true);
      
      console.log('🧪 Testing Firebase read...');
      
      // Try SDK first
      let result = await firebaseService.getDriverLocation('TEST_TENANT', 'TEST_VENDOR', 'TEST_DRIVER_001');

      // If SDK fails, try HTTP fallback
      if (!result.success) {
        console.log('🔄 SDK read failed, trying HTTP Firebase...');
        result = await httpFirebaseService.getDriverLocation('TEST_TENANT', 'TEST_VENDOR', 'TEST_DRIVER_001');
      }

      if (result.success) {
        Alert.alert('✅ Read Test Passed', `Data: ${JSON.stringify(result.data, null, 2)}`);
        setLastTestResult('Firebase read: ✅ PASS');
      } else {
        Alert.alert('⚠️ No Data', 'No test data found. Run Firebase connection test first.');
        setLastTestResult('Firebase read: ⚠️ NO DATA');
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
      setLastTestResult(`Firebase read: ❌ ERROR - ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Location Testing</Text>
        <Text style={styles.subtitle}>Test Firebase & Location Services</Text>
      </View>

      {/* Status Display */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>📊 Current Status</Text>
        <Text style={styles.statusText}>
          Tracking: {isTracking ? '🟢 Active' : '🔴 Inactive'}
        </Text>
        {lastKnownLocation && (
          <>
            <Text style={styles.statusText}>
              Lat: {lastKnownLocation.latitude?.toFixed(6)}
            </Text>
            <Text style={styles.statusText}>
              Lon: {lastKnownLocation.longitude?.toFixed(6)}
            </Text>
          </>
        )}
        {lastTestResult && (
          <Text style={styles.testResult}>{lastTestResult}</Text>
        )}
      </View>

      {/* Test Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.testButton, styles.primaryButton]}
          onPress={testFirebaseConnection}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>🔥 Test Firebase Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.secondaryButton]}
          onPress={testLocationService}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>📍 Test Location Service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.tertiaryButton]}
          onPress={testFirebaseRead}
          disabled={isLoading}
        >
          <Text style={styles.tertiaryButtonText}>📖 Test Firebase Read</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.integrationButton]}
          onPress={testFullIntegration}
          disabled={isLoading}
        >
          <Text style={styles.integrationButtonText}>⚡ Test Full Integration</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.urlTestButton]}
          onPress={testFirebaseUrl}
          disabled={isLoading}
        >
          <Text style={styles.urlTestButtonText}>🌐 Test Firebase URL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.debugButton]}
          onPress={testSessionData}
          disabled={isLoading}
        >
          <Text style={styles.debugButtonText}>🔍 Debug Session Data</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>📋 Test Instructions</Text>
        <Text style={styles.instructionText}>
          1. <Text style={styles.bold}>Firebase Connection</Text>: Tests basic Firebase write
        </Text>
        <Text style={styles.instructionText}>
          2. <Text style={styles.bold}>Location Service</Text>: Tests GPS coordinate retrieval
        </Text>
        <Text style={styles.instructionText}>
          3. <Text style={styles.bold}>Firebase Read</Text>: Tests reading data from Firebase
        </Text>
        <Text style={styles.instructionText}>
          4. <Text style={styles.bold}>Full Integration</Text>: Tests complete location → Firebase flow
        </Text>
        <Text style={styles.instructionText}>
          5. <Text style={styles.bold}>Debug Session</Text>: Shows session data and extracted IDs
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  statusContainer: {
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  testResult: {
    fontSize: 12,
    color: '#495057',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  testButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderColor: '#28a745',
    borderWidth: 1,
  },
  tertiaryButton: {
    backgroundColor: 'white',
    borderColor: '#ffc107',
    borderWidth: 1,
  },
  integrationButton: {
    backgroundColor: '#6f42c1',
  },
  urlTestButton: {
    backgroundColor: '#fd7e14',
  },
  debugButton: {
    backgroundColor: '#e83e8c',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#28a745',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButtonText: {
    color: '#856404',
    fontSize: 16,
    fontWeight: '600',
  },
  integrationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  urlTestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 6,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: '#495057',
  },
});

export default LocationTestScreen;