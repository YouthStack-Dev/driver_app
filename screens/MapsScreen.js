import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import overlayService from '../services/overlayService';

export default function MapsScreen({ route, navigation }) {
  const { destination, booking } = route.params;

  useEffect(() => {
    // Auto-open maps when screen loads
    openMaps();
  }, []);

  const openMaps = () => {
    const latitude = booking.pickup_latitude;
    const longitude = booking.pickup_longitude;
    const label = encodeURIComponent(destination);

    let url;
    
    if (Platform.OS === 'ios') {
      // iOS: Use Apple Maps
      url = `maps:0,0?q=${label}@${latitude},${longitude}`;
    } else {
      // Android: Use Google Maps
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch((err) => {
        Alert.alert('Error', 'Unable to open maps application');
        console.error('Maps error:', err);
      });
  };

  const openGoogleMaps = () => {
    const latitude = booking.pickup_latitude;
    const longitude = booking.pickup_longitude;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const openWaze = () => {
    const latitude = booking.pickup_latitude;
    const longitude = booking.pickup_longitude;
    const url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Navigate</Text>
          <Text style={styles.subtitle}>{booking.employee_code}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.destination}>{destination}</Text>
          
          <View style={styles.coordsRow}>
            <Text style={styles.coordLabel}>📍 Coordinates:</Text>
            <Text style={styles.coordValue}>
              {booking.pickup_latitude.toFixed(6)}, {booking.pickup_longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choose Navigation App</Text>

        <TouchableOpacity style={styles.mapButton} onPress={openMaps}>
          <View style={styles.mapButtonContent}>
            <Text style={styles.mapButtonIcon}>🗺️</Text>
            <View style={styles.mapButtonText}>
              <Text style={styles.mapButtonTitle}>
                {Platform.OS === 'ios' ? 'Apple Maps' : 'Google Maps'}
              </Text>
              <Text style={styles.mapButtonSubtitle}>Default navigation app</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mapButton} onPress={openGoogleMaps}>
          <View style={styles.mapButtonContent}>
            <Text style={styles.mapButtonIcon}>🌍</Text>
            <View style={styles.mapButtonText}>
              <Text style={styles.mapButtonTitle}>Google Maps</Text>
              <Text style={styles.mapButtonSubtitle}>Open in browser</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mapButton} onPress={openWaze}>
          <View style={styles.mapButtonContent}>
            <Text style={styles.mapButtonIcon}>🚗</Text>
            <View style={styles.mapButtonText}>
              <Text style={styles.mapButtonTitle}>Waze</Text>
              <Text style={styles.mapButtonSubtitle}>Community-based navigation</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToRideButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backToRideText}>← Back to Ride Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  backButton: {
    marginRight: 15,
  },
  backIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  label: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  destination: {
    fontSize: 16,
    color: '#2d3436',
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 22,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  coordLabel: {
    fontSize: 12,
    color: '#636e72',
    marginRight: 8,
  },
  coordValue: {
    fontSize: 12,
    color: '#2d3436',
    fontWeight: '600',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 12,
  },
  mapButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  mapButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapButtonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  mapButtonText: {
    flex: 1,
  },
  mapButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 4,
  },
  mapButtonSubtitle: {
    fontSize: 12,
    color: '#636e72',
  },
  backToRideButton: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
  },
  backToRideText: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
  },
});
