import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Animated, Dimensions, BackHandler, Alert, AppState, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getDriverTrips, startDuty, startTrip, endDuty, markNoShow, dropTrip } from '../services/routeService';
import Toast from '../components/Toast';
import { useFocusEffect } from '@react-navigation/native';
import sessionService from '../services/sessionService';
import overlayService from '../services/overlayService';

export default function RidesScreen({ navigation }) {
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [driverId, setDriverId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startingDuty, setStartingDuty] = useState(null); // Track which route is starting duty
  const [hasActiveDuty, setHasActiveDuty] = useState(false); // Track if driver has active ongoing duty
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [currentBooking, setCurrentBooking] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [processingPickup, setProcessingPickup] = useState(null);
  const [processingNoShow, setProcessingNoShow] = useState(null);
  const [processingDrop, setProcessingDrop] = useState(null);
  const [dropOtpModalVisible, setDropOtpModalVisible] = useState(false);
  const [dropOtpValue, setDropOtpValue] = useState('');
  const [currentDropBooking, setCurrentDropBooking] = useState(null);
  const [currentDropRoute, setCurrentDropRoute] = useState(null);
  const [endDutyModalVisible, setEndDutyModalVisible] = useState(false);
  const [endDutyReason, setEndDutyReason] = useState('');
  const [routeToEnd, setRouteToEnd] = useState(null);
  const [hasOverlayPermission, setHasOverlayPermission] = useState(true); // Set to true to skip overlay for Expo testing
  const drawerAnimation = useState(new Animated.Value(-280))[0];

  useEffect(() => {
    loadDriverIdAndRoutes();
    // checkOverlayPermission(); // Disabled for Expo testing
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Check overlay permission periodically
    // Disabled for Expo testing
    // const intervalId = setInterval(async () => {
    //   await checkOverlayPermission();
    // }, 3000);

    // return () => clearInterval(intervalId);
  }, []);

  const checkOverlayPermission = async () => {
    const hasPermission = await overlayService.checkPermission();
    setHasOverlayPermission(hasPermission);
    
    if (!hasPermission) {
      requestOverlayPermission();
    }
  };

  const requestOverlayPermission = () => {
    Alert.alert(
      '⚠️ Overlay Permission Required',
      'This app requires permission to display a floating icon when running in the background. This is MANDATORY to use the app and helps you return quickly while using maps or other apps.',
      [
        {
          text: 'Grant Permission',
          onPress: async () => {
            await overlayService.requestPermission();
            // Recheck after a delay to see if permission was granted
            setTimeout(async () => {
              const granted = await overlayService.checkPermission();
              if (!granted) {
                // User didn't grant permission, ask again
                setTimeout(() => requestOverlayPermission(), 1000);
              } else {
                setHasOverlayPermission(true);
              }
            }, 1000);
          }
        },
        {
          text: 'Exit App',
          onPress: () => BackHandler.exitApp(),
          style: 'destructive'
        }
      ],
      { cancelable: false }
    );
  };
  const handleAppStateChange = async (nextAppState) => {
    // Overlay disabled for Expo testing
    // if (nextAppState === 'background' || nextAppState === 'inactive') {
    //   await overlayService.showOverlay();
    // } else if (nextAppState === 'active') {
    //   await overlayService.hideOverlay();
    // }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Add back button handler only when this screen is focused
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; // Prevent default back behavior
      });

      // Clean up when screen loses focus
      return () => backHandler.remove();
    }, [])
  );

  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: drawerOpen ? 0 : -280,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen]);

  useFocusEffect(
    React.useCallback(() => {
      // Re-fetch routes when screen is focused (will auto-detect ongoing/upcoming)
      if (driverId) {
        fetchRoutes();
      }
    }, [driverId])
  );

  const loadDriverIdAndRoutes = async () => {
    try {
      const dId = await AsyncStorage.getItem('driver_id');
      if (dId) {
        setDriverId(dId);
        
        // Check if driver has any ongoing routes
        const ongoingResult = await getDriverTrips({
          statusFilter: 'ongoing',
          bookingDate: null // ongoing ignores date
        });
        
        if (ongoingResult.success && ongoingResult.routes && ongoingResult.routes.length > 0) {
          // Driver has active duty - show ongoing routes
          console.log('Driver has active duty, showing ongoing route');
          await AsyncStorage.setItem('has_active_duty', 'true');
          setHasActiveDuty(true);
          setRoutes(ongoingResult.routes);
          setFilteredRoutes(ongoingResult.routes);
          setLoading(false);
        } else {
          // No active duty - show upcoming routes
          console.log('No active duty, showing upcoming routes');
          await AsyncStorage.removeItem('has_active_duty');
          setHasActiveDuty(false);
          await fetchRoutes();
        }
      } else {
        setError('Driver ID not found. Please login again.');
        setLoading(false);
      }
    } catch (error) {
      console.log('Error loading data:', error);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    setLoading(true);
    setError('');
    
    // Check duty status to determine what to fetch
    const dutyStatus = await AsyncStorage.getItem('has_active_duty');
    
    if (dutyStatus === 'true') {
      // Fetch ongoing routes
      const result = await getDriverTrips({
        statusFilter: 'ongoing',
        bookingDate: null
      });
      
      if (result.success) {
        if (result.routes && result.routes.length > 0) {
          setRoutes(result.routes || []);
          setFilteredRoutes(result.routes || []);
          setHasActiveDuty(true);
        } else {
          // No ongoing routes found - duty must have ended
          await AsyncStorage.removeItem('has_active_duty');
          setHasActiveDuty(false);
          // Fetch upcoming routes instead
          await fetchUpcomingRoutes();
          setLoading(false);
          return;
        }
      } else {
        setError(result.error);
      }
    } else {
      // Fetch today's upcoming routes
      await fetchUpcomingRoutes();
    }
    
    setLoading(false);
  };

  const fetchUpcomingRoutes = async () => {
    // Always fetch today's upcoming routes
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    const result = await getDriverTrips({
      statusFilter: 'upcoming',
      bookingDate: todayDate
    });
    
    if (result.success) {
      setRoutes(result.routes || []);
      setFilteredRoutes(result.routes || []);
      setHasActiveDuty(false);
    } else {
      setError(result.error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (driverId) {
      await fetchRoutes();
    }
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await sessionService.clearSession();
    navigation.replace('Login');
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    // Handle "HH:MM:SS" format
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      const hour = parseInt(parts[0]);
      const min = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${min} ${ampm}`;
    }
    return timeStr;
  };

  const handleStartDuty = async (route) => {
    if (!route) return;
    
    setStartingDuty(route.route_id);
    
    try {
      const result = await startDuty(route.route_id);
      
      if (result.success) {
        // Set active duty status
        await AsyncStorage.setItem('has_active_duty', 'true');
        setHasActiveDuty(true);
        
        setToastMessage('Duty started successfully! Route is now ongoing.');
        setToastType('success');
        setShowToast(true);
        
        // Automatically switch to ongoing view by refreshing
        await fetchRoutes();
      } else {
        // Handle specific error codes
        if (result.errorCode === 'DRIVER_HAS_ONGOING_ROUTE') {
          Alert.alert(
            'Already On Duty',
            `You already have an ongoing route (${result.details?.ongoing_route_code || 'Route'}). Please complete it before starting a new duty.`,
            [
              { text: 'OK', style: 'default' }
            ]
          );
        } else if (result.errorCode === 'INVALID_ROUTE_STATE') {
          setToastMessage(`Cannot start duty: ${result.error || 'Invalid route state'}`);
          setToastType('error');
          setShowToast(true);
          // Refresh to get updated route status
          await fetchRoutes();
        } else {
          setToastMessage(result.error || 'Failed to start duty');
          setToastType('error');
          setShowToast(true);
        }
      }
    } catch (error) {
      console.log('Error starting duty:', error);
      setToastMessage('Network error. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setStartingDuty(null);
    }
  };

  const navigateToAddress = (latitude, longitude, address) => {
    if (!latitude || !longitude || !address) return;
    
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedAddress}`;
    
    Alert.alert(
      'Open Navigation',
      `Navigate to:\n${address}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Maps', onPress: () => {
          // Open in browser or maps app
          navigation.navigate('Maps', { 
            latitude, 
            longitude, 
            address 
          });
        }}
      ]
    );
  };

  const handlePickupPress = async (route, booking) => {
    if (!route || !booking) return;
    
    // Check if OTP is required
    if (booking.is_boarding_otp_required) {
      setCurrentBooking(booking);
      setCurrentRoute(route);
      setOtpModalVisible(true);
    } else {
      await startPickup(route, booking, null);
    }
  };

  const startPickup = async (route, booking, otp) => {
    if (!route || !booking) return;
    
    setProcessingPickup(booking.booking_id);
    
    try {
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to start pickup.');
        setProcessingPickup(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await startTrip({
        routeId: route.route_id,
        bookingId: booking.booking_id,
        otp: otp,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (result.success) {
        setToastMessage('Pickup started successfully!');
        setToastType('success');
        setShowToast(true);
        
        // Close OTP modal if open
        setOtpModalVisible(false);
        setOtpValue('');
        
        // Refresh routes to update status
        await fetchRoutes();
      } else {
        // Handle specific errors
        if (result.errorCode === 'ROUTE_NOT_ONGOING') {
          Alert.alert('Duty Not Started', 'Please start duty first before picking up passengers.');
        } else if (result.errorCode === 'PREVIOUS_PENDING_STOPS') {
          Alert.alert(
            'Previous Stops Pending',
            `Complete ${result.details?.pending_count || 'previous'} stops first.`
          );
        } else if (result.errorCode === 'DRIVER_TOO_FAR_FROM_PICKUP') {
          Alert.alert(
            'Too Far from Pickup',
            `You are ${Math.round(result.details?.distance_meters || 0)}m away. Move closer (max 500m allowed).`
          );
        } else if (result.errorCode === 'INVALID_BOARDING_OTP') {
          Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please try again.');
          setOtpValue('');
        } else {
          setToastMessage(result.error || 'Failed to start pickup');
          setToastType('error');
          setShowToast(true);
        }
      }
    } catch (error) {
      console.log('Error starting pickup:', error);
      setToastMessage('Failed to get location or start pickup');
      setToastType('error');
      setShowToast(true);
    } finally {
      setProcessingPickup(null);
    }
  };

  const handleOtpSubmit = () => {
    if (!otpValue || otpValue.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter a valid OTP');
      return;
    }
    startPickup(currentRoute, currentBooking, otpValue);
  };

  const handleNoShowPress = async (route, booking) => {
    if (!route || !booking) return;
    
    Alert.alert(
      'Mark as No Show',
      `Are you sure you want to mark ${booking.employee_name || 'this passenger'} as No Show?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark No Show',
          style: 'destructive',
          onPress: () => markPassengerNoShow(route, booking)
        }
      ]
    );
  };

  const markPassengerNoShow = async (route, booking) => {
    if (!route || !booking) return;
    
    setProcessingNoShow(booking.booking_id);

    try {
      const result = await markNoShow({
        routeId: route.route_id,
        bookingId: booking.booking_id,
        reason: 'Passenger did not show up'
      });

      if (result.success) {
        setToastMessage('Passenger marked as No Show');
        setToastType('success');
        setShowToast(true);

        // Refresh routes to update status
        await fetchRoutes();
      } else {
        setToastMessage(result.error || 'Failed to mark as No Show');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      console.log('Error marking no show:', error);
      setToastMessage('Failed to mark as No Show');
      setToastType('error');
      setShowToast(true);
    } finally {
      setProcessingNoShow(null);
    }
  };

  const handleDropPress = async (route, booking) => {
    if (!route || !booking) return;
    
    // Check if OTP is required for drop
    if (booking.is_deboarding_otp_required) {
      setCurrentDropBooking(booking);
      setCurrentDropRoute(route);
      setDropOtpModalVisible(true);
    } else {
      await dropPassenger(route, booking, null);
    }
  };

  const dropPassenger = async (route, booking, otp) => {
    if (!route || !booking) return;
    
    setProcessingDrop(booking.booking_id);
    
    try {
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to drop passenger.');
        setProcessingDrop(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await dropTrip({
        routeId: route.route_id,
        bookingId: booking.booking_id,
        otp: otp,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (result.success) {
        setToastMessage('Passenger dropped successfully!');
        setToastType('success');
        setShowToast(true);
        
        // Close OTP modal if open
        setDropOtpModalVisible(false);
        setDropOtpValue('');
        
        // Refresh routes to update status
        await fetchRoutes();
      } else {
        // Handle specific errors
        if (result.errorCode === 'DRIVER_TOO_FAR_FROM_DROP') {
          Alert.alert(
            'Too Far from Drop Location',
            `You are ${Math.round(result.details?.distance_meters || 0)}m away. Move closer (max 500m allowed).`
          );
        } else if (result.errorCode === 'INVALID_DEBOARDING_OTP') {
          Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please try again.');
          setDropOtpValue('');
        } else if (result.errorCode === 'ROUTE_NOT_FOUND_OR_INVALID_STATE') {
          Alert.alert('Error', 'Route not found or not in valid state.');
        } else {
          setToastMessage(result.error || 'Failed to drop passenger');
          setToastType('error');
          setShowToast(true);
        }
      }
    } catch (error) {
      console.log('Error dropping passenger:', error);
      setToastMessage('Failed to get location or drop passenger');
      setToastType('error');
      setShowToast(true);
    } finally {
      setProcessingDrop(null);
    }
  };

  const handleDropOtpSubmit = () => {
    if (!dropOtpValue || dropOtpValue.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter a valid OTP');
      return;
    }
    dropPassenger(currentDropRoute, currentDropBooking, dropOtpValue);
  };

  const handleEndDuty = async (route) => {
    if (!route) return;
    
    Alert.alert(
      'End Duty',
      'Are you sure you want to end your duty? All remaining stops will be processed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Duty',
          style: 'destructive',
          onPress: () => {
            setRouteToEnd(route);
            setEndDutyModalVisible(true);
          }
        }
      ]
    );
  };

  const handleEndDutySubmit = (skipReason = false) => {
    if (!routeToEnd) return;
    
    const reason = skipReason ? null : (endDutyReason.trim() || null);
    executeEndDuty(routeToEnd, reason);
    setEndDutyModalVisible(false);
    setEndDutyReason('');
  };

  const executeEndDuty = async (route, reason) => {
    if (!route) return;
    
    setLoading(true);
    
    try {
      const result = await endDuty(route.route_id, reason);
      
      if (result.success) {
        // Clear active duty status
        await AsyncStorage.removeItem('has_active_duty');
        setHasActiveDuty(false);
        
        // Show success message
        Alert.alert(
          'Duty Ended Successfully',
          'Route completed successfully!',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Automatically navigate back to upcoming trips
                setToastMessage('Duty ended. Showing upcoming schedules.');
                setToastType('success');
                setShowToast(true);
                await fetchRoutes();
              }
            }
          ]
        );
      } else {
        // Handle specific error codes
        if (result.errorCode === 'PENDING_BOOKINGS_EXIST') {
          const pendingCount = result.details?.pending_count || 'some';
          Alert.alert(
            'Cannot End Duty',
            `You have ${pendingCount} pending booking(s). Please complete all pickups/drops or mark as no-show before ending duty.`,
            [{ text: 'OK' }]
          );
        } else if (result.errorCode === 'INVALID_ROUTE_STATE') {
          Alert.alert('Cannot End Duty', 'Route is not ongoing.', [{ text: 'OK' }]);
        } else if (result.errorCode === 'ROUTE_NOT_FOUND') {
          Alert.alert('Error', 'Route not found or not assigned to you.', [{ text: 'OK' }]);
        } else {
          setToastMessage(result.error || 'Failed to end duty');
          setToastType('error');
          setShowToast(true);
        }
      }
    } catch (error) {
      console.log('Error ending duty:', error);
      setToastMessage('Network error. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };



  const renderRouteCard = (route, index) => {
    // Add null check for route
    if (!route) return null;
    
    const totalStops = route.stops?.length || 0;
    const totalDistance = route.summary?.total_distance_km || 0;
    const totalTime = route.summary?.total_time_minutes || 0;
    const shiftTime = formatTime(route.shift_time);
    
    // Simplified view for upcoming routes
    if (route.status === 'Driver Assigned') {
      return (
        <View key={route.route_id || index} style={styles.simpleRouteCard}>
          <View style={styles.simpleCardContent}>
            <View style={styles.simpleCardRow}>
              <Text style={styles.simpleRouteId}>Route #{route.route_id}</Text>
              <Text style={styles.simpleRouteTime}>🕐 {shiftTime}</Text>
            </View>
            
            <View style={styles.simpleCardRow}>
              <View style={styles.simpleInfoItem}>
                <Text style={styles.simpleInfoIcon}>👥</Text>
                <Text style={styles.simpleInfoText}>{totalStops}</Text>
              </View>
              <View style={styles.simpleInfoItem}>
                <Text style={styles.simpleInfoIcon}>📏</Text>
                <Text style={styles.simpleInfoText}>{totalDistance.toFixed(1)} km</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[
                styles.simpleStartDutyButton,
                startingDuty === route.route_id && styles.startDutyButtonDisabled
              ]}
              onPress={() => handleStartDuty(route)}
              disabled={startingDuty === route.route_id}
              activeOpacity={0.7}
            >
              {startingDuty === route.route_id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.simpleStartDutyButtonText}>🚀 Start Duty</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Full view for ongoing routes (always expanded)
    return (
      <View
        key={route?.route_id || index}
        style={styles.routeCard}
      >
        {/* Header - No collapsible functionality */}
        <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.routeInfoRow}>
              <Text style={styles.routeName}>Route #{route?.route_id || 'N/A'}</Text>
              <View style={[styles.statusBadge, route?.log_type === 'IN' ? styles.pickupBadge : styles.dropBadge]}>
                <Text style={styles.statusText}>{route?.log_type === 'IN' ? '🏠' : '🏢'} {route?.log_type === 'IN' ? 'Pickup' : 'Drop'}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.routeTime}>🕐 {shiftTime}</Text>
            </View>
          </View>

          {/* Summary Stats */}
          <View style={styles.routeFooter}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoIcon}>👥</Text>
              <Text style={styles.routeInfoText}>{totalStops}</Text>
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoIcon}>📏</Text>
              <Text style={styles.routeInfoText}>{totalDistance.toFixed(1)} km</Text>
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoIcon}>⏱️</Text>
              <Text style={styles.routeInfoText}>{Math.round(totalTime)} min</Text>
            </View>
          </View>
        </View>

        {/* Always Expanded Details */}
        <View style={styles.expandedContent}>
          {/* Passengers List */}
          <View style={styles.passengersSection}>
            <Text style={styles.sectionTitle}>Passengers ({totalStops})</Text>
            
            {route.stops?.map((stop, idx) => {
              // Skip if stop is null or undefined
              if (!stop || typeof stop !== 'object') return null;
              
              const isPickup = route?.log_type === 'IN';
              
              // Determine what to show based on booking status
              let showAddress = true;
              let showNavigate = true;
              let displayLocation = '';
              let displayLat = null;
              let displayLng = null;
              let addressLabel = '';
              
              if (stop.status === 'NoShow' || stop.status === 'No Show' || stop.status === 'No-Show') {
                // NoShow/No Show/No-Show: hide address and navigate button
                showAddress = false;
                showNavigate = false;
              } else if (stop.status === 'Ongoing') {
                // Ongoing: show drop location
                displayLocation = stop.drop_location || 'Drop location not specified';
                displayLat = stop.drop_latitude;
                displayLng = stop.drop_longitude;
                addressLabel = 'Drop Address:';
              } else {
                // Other statuses: show pickup location
                displayLocation = stop.pickup_location || 'Pickup location not specified';
                displayLat = stop.pickup_latitude;
                displayLng = stop.pickup_longitude;
                addressLabel = 'Pickup Address:';
              }
              
              return (
              <View key={stop.booking_id || idx} style={styles.passengerCard}>
                <View style={styles.passengerHeader}>
                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerName}>{stop?.employee_name || 'Unknown Passenger'}</Text>
                    <Text style={styles.passengerPhone}>📞 {stop?.employee_phone || 'N/A'}</Text>
                  </View>
                  <View style={[styles.passengerStatusBadge, getStatusBadgeStyle(stop?.status)]}>
                    <Text style={styles.passengerStatusText}>{stop?.status || 'Unknown'}</Text>
                  </View>
                </View>
                
                {showAddress && (
                  <View style={styles.passengerDetails}>
                    <Text style={styles.passengerAddressLabel}>
                      📍 {addressLabel}
                    </Text>
                    <Text style={styles.passengerAddress}>{displayLocation}</Text>
                    
                    <View style={styles.passengerMetaRow}>
                      <Text style={styles.passengerDetailText}>
                        🕐 ETA: {formatTime(stop.estimated_pick_up_time)}
                      </Text>
                      {stop.is_boarding_otp_required && (
                        <Text style={styles.otpRequired}>🔐 OTP Required</Text>
                      )}
                    </View>

                    {/* Navigate Button */}
                    {showNavigate && displayLat && displayLng && (
                      <TouchableOpacity 
                        style={styles.navigateButton}
                        onPress={() => navigateToAddress(displayLat, displayLng, displayLocation)}
                      >
                        <Text style={styles.navigateButtonText}>
                          🧭 Navigate to {stop.status === 'Ongoing' ? 'Drop' : 'Pickup'} Address
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Action Buttons for Ongoing Routes */}
                {route?.status === 'Ongoing' && stop?.status === 'Scheduled' && (
                  <View style={styles.passengerActions}>
                    <TouchableOpacity 
                      style={[
                        styles.pickupButton,
                        processingPickup === stop.booking_id && styles.buttonDisabled
                      ]}
                      onPress={() => handlePickupPress(route, stop)}
                      disabled={processingPickup === stop?.booking_id}
                    >
                      {processingPickup === stop.booking_id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.pickupButtonText}>✅ Start Pickup</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.noShowButton,
                        processingNoShow === stop.booking_id && styles.buttonDisabled
                      ]}
                      onPress={() => handleNoShowPress(route, stop)}
                      disabled={processingNoShow === stop?.booking_id}
                    >
                      {processingNoShow === stop.booking_id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.noShowButtonText}>❌ No Show</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {route?.status === 'Ongoing' && stop?.status === 'Ongoing' && (
                  <TouchableOpacity 
                    style={[
                      styles.dropButton,
                      processingDrop === stop.booking_id && styles.buttonDisabled
                    ]}
                    onPress={() => handleDropPress(route, stop)}
                    disabled={processingDrop === stop?.booking_id}
                  >
                    {processingDrop === stop.booking_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.dropButtonText}>🏁 Drop Off</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )})}
          </View>

          {/* Action Buttons */}
          {route?.status === 'Ongoing' && (
            <View style={styles.ongoingActions}>
              <TouchableOpacity 
                style={styles.endDutyButton}
                onPress={() => handleEndDuty(route)}
              >
                <Text style={styles.endDutyButtonText}>🏁 End Duty</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Completed':
        return styles.statusCompleted;
      case 'Ongoing':
        return styles.statusOngoing;
      case 'Scheduled':
        return styles.statusScheduled;
      case 'NoShow':
      case 'No Show':
      case 'No-Show':
        return styles.statusNoShow;
      default:
        return styles.statusScheduled;
    }
  };

  // Block app usage if overlay permission not granted
  if (!hasOverlayPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.permissionIcon}>⚠️</Text>
          <Text style={styles.permissionTitle}>Permission Required</Text>
          <Text style={styles.permissionText}>
            This app requires overlay permission to display a floating icon when in background.
          </Text>
          <Text style={styles.permissionSubtext}>
            This is mandatory to use the app. Please grant the permission to continue.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestOverlayPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.exitButton}
            onPress={() => BackHandler.exitApp()}
          >
            <Text style={styles.exitButtonText}>Exit App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast 
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={() => setShowToast(false)}
        duration={3000}
      />

      {/* Overlay */}
      {drawerOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={closeDrawer}
        />
      )}

      {/* Sidebar Drawer */}
      <Animated.View 
        style={[
          styles.drawer,
          { transform: [{ translateX: drawerAnimation }] }
        ]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>MLT</Text>
          <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.drawerContent}>

          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); navigation.navigate('Profile'); }}>
            <Text style={styles.drawerItemText}>👤 Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); }}>
            <Text style={styles.drawerItemText}>📅 My Schedules</Text>
          </TouchableOpacity>
          
          <View style={styles.drawerDivider} />
          
          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); navigation.navigate('SwitchAccount'); }}>
            <Text style={styles.drawerItemText}>🔄 Switch Company</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={() => { closeDrawer(); handleLogout(); }}>
            <Text style={[styles.drawerItemText, styles.logoutText]}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
            <View style={styles.menuIcon}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>My Schedules</Text>
            <Text style={styles.subtitle}>
              {hasActiveDuty ? '🔄 On Duty' : '📅 Upcoming'}
            </Text>
          </View>
        </View>
        
        {/* Refresh Button */}
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? '⏳' : '🔄'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Loading routes...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredRoutes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>
                {hasActiveDuty ? 'No ongoing duty' : 'No upcoming schedules'}
              </Text>
              <Text style={styles.emptySubtext}>
                {hasActiveDuty 
                  ? 'Complete your current duty to see new routes' 
                  : 'Your assigned routes for today will appear here'}
              </Text>
            </View>
          ) : (
            filteredRoutes.map((route, index) => renderRouteCard(route, index))
          )}
        </ScrollView>
      )}

      {/* OTP Modal */}
      <Modal
        visible={otpModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setOtpModalVisible(false);
          setOtpValue('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.otpModal}>
            <Text style={styles.otpModalTitle}>Enter Boarding OTP</Text>
            <Text style={styles.otpModalSubtitle}>
              {currentBooking?.employee_name}
            </Text>
            
            <TextInput
              style={styles.otpInput}
              value={otpValue}
              onChangeText={setOtpValue}
              placeholder="Enter OTP"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
            />

            <View style={styles.otpModalActions}>
              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpCancelButton]}
                onPress={() => {
                  setOtpModalVisible(false);
                  setOtpValue('');
                }}
              >
                <Text style={styles.otpCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpSubmitButton]}
                onPress={handleOtpSubmit}
                disabled={processingPickup !== null}
              >
                {processingPickup ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.otpSubmitButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Drop OTP Modal */}
      <Modal
        visible={dropOtpModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setDropOtpModalVisible(false);
          setDropOtpValue('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.otpModal}>
            <Text style={styles.otpModalTitle}>Enter Drop-off OTP</Text>
            <Text style={styles.otpModalSubtitle}>
              {currentDropBooking?.employee_name}
            </Text>
            
            <TextInput
              style={styles.otpInput}
              value={dropOtpValue}
              onChangeText={setDropOtpValue}
              placeholder="Enter OTP"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
            />

            <View style={styles.otpModalActions}>
              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpCancelButton]}
                onPress={() => {
                  setDropOtpModalVisible(false);
                  setDropOtpValue('');
                }}
              >
                <Text style={styles.otpCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpSubmitButton]}
                onPress={handleDropOtpSubmit}
                disabled={processingDrop !== null}
              >
                {processingDrop ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.otpSubmitButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Duty Reason Modal */}
      <Modal
        visible={endDutyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setEndDutyModalVisible(false);
          setEndDutyReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.otpModal}>
            <Text style={styles.otpModalTitle}>End Duty Reason</Text>
            <Text style={styles.otpModalSubtitle}>
              Optional: Provide a reason for ending duty
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              value={endDutyReason}
              onChangeText={setEndDutyReason}
              placeholder="Enter reason (optional)"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus={true}
            />

            <View style={styles.otpModalActions}>
              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpCancelButton]}
                onPress={() => {
                  setEndDutyModalVisible(false);
                  setEndDutyReason('');
                }}
              >
                <Text style={styles.otpCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.otpModalButton, styles.skipButton]}
                onPress={() => handleEndDutySubmit(true)}
              >
                <Text style={styles.otpCancelButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.otpModalButton, styles.otpSubmitButton]}
                onPress={() => handleEndDutySubmit(false)}
              >
                <Text style={styles.otpSubmitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#fff',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#6C63FF',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  drawerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 10,
  },
  drawerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  drawerItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  logoutItem: {
    marginTop: 'auto',
    borderBottomWidth: 0,
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    color: '#d9534f',
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  menuIcon: {
    width: 28,
    height: 22,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 3,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  refreshButtonText: {
    fontSize: 18,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dateIcon: {
    fontSize: 15,
    marginRight: 7,
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },
  dropdownIcon: {
    color: '#fff',
    fontSize: 10,
  },
  logoutButton: {
    padding: 4,
  },
  logoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoutIconText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636e72',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCountBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
  },
  tabCountBadgeActive: {
    backgroundColor: '#fff',
  },
  tabCount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6C63FF',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 30,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  simpleRouteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  simpleCardContent: {
    padding: 16,
  },
  simpleCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  simpleRouteId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  simpleRouteTime: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
  },
  simpleInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  simpleInfoIcon: {
    fontSize: 14,
    color: '#636e72',
  },
  simpleInfoText: {
    fontSize: 14,
    color: '#2d3436',
    fontWeight: '600',
  },
  simpleStartDutyButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  simpleStartDutyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  routeTime: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pickupBadge: {
    backgroundColor: '#ffeaa7',
  },
  dropBadge: {
    backgroundColor: '#74b9ff',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 10,
  },
  passengersSection: {
    marginTop: 12,
  },
  passengerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 2,
  },
  passengerPhone: {
    fontSize: 12,
    color: '#636e72',
  },
  passengerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  passengerStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusScheduled: {
    backgroundColor: '#74b9ff',
  },
  statusOngoing: {
    backgroundColor: '#fdcb6e',
  },
  statusCompleted: {
    backgroundColor: '#00b894',
  },
  statusNoShow: {
    backgroundColor: '#d63031',
  },
  passengerDetails: {
    marginTop: 8,
  },
  passengerAddressLabel: {
    fontSize: 11,
    color: '#636e72',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  passengerAddress: {
    fontSize: 13,
    color: '#2d3436',
    lineHeight: 18,
    marginBottom: 8,
  },
  passengerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerDetailText: {
    fontSize: 12,
    color: '#636e72',
  },
  otpRequired: {
    fontSize: 11,
    color: '#6C63FF',
    fontWeight: '600',
    backgroundColor: '#e8e6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  navigateButton: {
    backgroundColor: '#0984e3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  passengerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pickupButton: {
    flex: 1,
    backgroundColor: '#00b894',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickupButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  noShowButton: {
    flex: 1,
    backgroundColor: '#d63031',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  noShowButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dropButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  dropButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  otpModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 8,
    textAlign: 'center',
  },
  otpModalSubtitle: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 20,
    textAlign: 'center',
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderRadius: 8,
    padding: 15,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  otpModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  otpModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  otpCancelButton: {
    backgroundColor: '#dfe6e9',
  },
  otpCancelButtonText: {
    color: '#2d3436',
    fontSize: 15,
    fontWeight: 'bold',
  },
  otpSubmitButton: {
    backgroundColor: '#6C63FF',
  },
  otpSubmitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  ongoingActions: {
    marginTop: 12,
  },
  endDutyButton: {
    backgroundColor: '#d63031',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  endDutyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  locationSection: {
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 9,
    color: '#636e72',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 13,
    color: '#2d3436',
    fontWeight: '500',
    lineHeight: 16,
  },
  stopsIndicator: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginVertical: 6,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  stopsText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeInfoIcon: {
    fontSize: 13,
  },
  routeInfoText: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '600',
  },
  startDutyButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  startDutyButtonDisabled: {
    backgroundColor: '#a29bfe',
    opacity: 0.7,
  },
  startDutyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  ongoingBadge: {
    backgroundColor: '#00b894',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  ongoingBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#636e72',
  },
  errorText: {
    color: '#d63031',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    padding: 50,
    marginTop: 50,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#636e72',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#b2bec3',
    textAlign: 'center',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  routeStatusLabel: {
    fontSize: 11,
    color: '#636e72',
    fontWeight: '600',
    marginRight: 5,
  },
  routeStatusValue: {
    fontSize: 11,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  permissionIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 15,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#636e72',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 30,
    lineHeight: 24,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#d63031',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 30,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exitButton: {
    backgroundColor: '#dfe6e9',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  exitButtonText: {
    color: '#2d3436',
    fontSize: 16,
    fontWeight: '600',
  },
  reasonInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 20,
    minHeight: 80,
  },
  skipButton: {
    backgroundColor: '#95a5a6',
    flex: 1,
  },
});
