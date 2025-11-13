import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../components/Toast';

export default function RideDetailsScreen({ route, navigation }) {
  const { routeData } = route.params;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [otp, setOtp] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const otpInputRefs = [
    React.useRef(null),
    React.useRef(null),
    React.useRef(null),
    React.useRef(null),
  ];

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = () => {
    const sortedBookings = (routeData.stops || [])
      .map((stop) => ({
        ...stop,
        status: mapBookingStatus(stop.status, stop.actual_pick_up_time, stop.actual_drop_time),
        sequence: stop.order_id,
        employee_name: stop.employee_code || `Employee ${stop.employee_id}`,
      }))
      .sort((a, b) => a.order_id - b.order_id);
    
    console.log('Loaded bookings:', sortedBookings);
    setBookings(sortedBookings);
  };

  const mapBookingStatus = (apiStatus, actualPickupTime, actualDropTime) => {
    // Check for No-Show status first
    if (apiStatus === 'No-Show') {
      return 'no-show';
    }
    
    if (apiStatus === 'Completed' && actualDropTime) {
      return 'dropped';
    }
    if (actualPickupTime && !actualDropTime) {
      return 'picked';
    }
    return 'pending';
  };

  const handleOtpSubmit = async () => {
    if (!otp || otp.length !== 4) {
      showToastMessage('Please enter complete 4-digit OTP', 'error');
      return;
    }

    setSubmittingOtp(true);

    try {
      const token = await AsyncStorage.getItem('access_token');
      
      const response = await fetch(
        `https://api.gocab.tech/api/v1/driver/start?route_id=${routeData.route_id}&booking_id=${selectedBooking.booking_id}&otp=${otp}`,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        showToastMessage('Trip started successfully!', 'success');
        setShowOtpModal(false);
        setOtp('');
        
        setBookings(prev => prev.map(b => 
          b.booking_id === selectedBooking.booking_id 
            ? { ...b, status: 'picked' }
            : b
        ));
      } else {
        // Close modal first, then show error toast
        setShowOtpModal(false);
        setOtp('');
        setTimeout(() => {
          showToastMessage(data.message || 'Invalid OTP', 'error');
        }, 300);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      // Close modal first, then show error toast
      setShowOtpModal(false);
      setOtp('');
      setTimeout(() => {
        showToastMessage('Failed to verify OTP', 'error');
      }, 300);
    } finally {
      setSubmittingOtp(false);
    }
  };

  const handleOtpChange = (value, index) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const otpArray = otp.split('');
    otpArray[index] = value;
    const newOtp = otpArray.join('');
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace') {
      const otpArray = otp.split('');
      if (!otpArray[index] && index > 0) {
        // If current is empty, go to previous and clear it
        otpInputRefs[index - 1].current?.focus();
        otpArray[index - 1] = '';
        setOtp(otpArray.join(''));
      } else {
        // Clear current
        otpArray[index] = '';
        setOtp(otpArray.join(''));
      }
    }
  };

  const clearOtp = () => {
    setOtp('');
    otpInputRefs[0].current?.focus();
  };

  const handleDrop = async (booking) => {
    Alert.alert(
      'Confirm Drop',
      `Mark ${booking.employee_code} as dropped?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('access_token');
              
              const response = await fetch(
                `https://api.gocab.tech/api/v1/driver/trip/drop?route_id=${routeData.route_id}&booking_id=${booking.booking_id}`,
                {
                  method: 'PUT',
                  headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              const data = await response.json();

              if (response.ok) {
                showToastMessage('Passenger dropped successfully!', 'success');
                
                setBookings(prev => prev.map(b => 
                  b.booking_id === booking.booking_id 
                    ? { ...b, status: 'dropped' }
                    : b
                ));
              } else {
                showToastMessage(data.message || 'Failed to mark as dropped', 'error');
              }
            } catch (error) {
              console.error('Drop error:', error);
              showToastMessage('Failed to mark as dropped', 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleNoShow = async (booking) => {
    Alert.alert(
      'Mark as No Show',
      `Confirm ${booking.employee_code} did not show up?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm No Show',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('access_token');
              
              const response = await fetch(
                `https://api.gocab.tech/api/v1/driver/trip/no-show?route_id=${routeData.route_id}&booking_id=${booking.booking_id}`,
                {
                  method: 'PUT',
                  headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              const data = await response.json();

              if (response.ok) {
                showToastMessage('Marked as no show', 'success');
                
                setBookings(prev => prev.map(b => 
                  b.booking_id === booking.booking_id 
                    ? { ...b, status: 'no-show' }
                    : b
                ));
              } else {
                showToastMessage(data.message || 'Failed to mark as no show', 'error');
              }
            } catch (error) {
              console.error('No show error:', error);
              showToastMessage('Failed to mark as no show', 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleNavigate = (booking) => {
    const location = routeData.log_type === 'IN' 
      ? booking.pickup_location 
      : booking.drop_location;
    
    navigation.navigate('Maps', { 
      destination: location,
      booking: booking 
    });
  };

  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const renderBookingCard = (booking) => {
    const isPending = booking.status === 'pending';
    const isPicked = booking.status === 'picked';
    const isDropped = booking.status === 'dropped';
    const isNoShow = booking.status === 'no-show';

    return (
      <View key={booking.booking_id} style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.sequenceContainer}>
            <Text style={styles.sequenceNumber}>{booking.order_id}</Text>
          </View>
          <View style={styles.bookingInfo}>
            <Text style={styles.employeeName}>{booking.employee_code}</Text>
            <Text style={styles.employeeId}>ID: {booking.employee_id}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            isPending && styles.pendingBadge,
            isPicked && styles.pickedBadge,
            isDropped && styles.droppedBadge,
            isNoShow && styles.noShowBadge
          ]}>
            <Text style={styles.statusText}>
              {isPending ? 'Pending' : isPicked ? 'Picked' : isNoShow ? 'No Show' : 'Completed'}
            </Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRowWithNav}>
            <View style={styles.locationMainContent}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>
                  {routeData.log_type === 'IN' ? 'Pickup Location' : 'Drop Location'}
                </Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {routeData.log_type === 'IN' ? booking.pickup_location : booking.drop_location}
                </Text>
              </View>
            </View>
            {(isPicked || isPending) && (
              <TouchableOpacity
                style={styles.navigateIconButton}
                onPress={() => handleNavigate(booking)}
              >
                <Image 
                  source={require('../assets/navigator.png')} 
                  style={styles.navigatorIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
          </View>

          {(booking.estimated_pick_up_time || booking.actual_pick_up_time) && (
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>
                {booking.actual_pick_up_time ? 'Picked at:' : 'ETA:'}
              </Text>
              <Text style={styles.timingValue}>
                {booking.actual_pick_up_time || booking.estimated_pick_up_time}
              </Text>
            </View>
          )}

          {booking.actual_drop_time && (
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>Dropped at:</Text>
              <Text style={styles.timingValue}>{booking.actual_drop_time}</Text>
            </View>
          )}

          {booking.estimated_distance && (
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>Distance:</Text>
              <Text style={styles.timingValue}>{booking.estimated_distance.toFixed(1)} km</Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          {isPending && (
            <>
              <TouchableOpacity
                style={styles.otpButton}
                onPress={() => {
                  setSelectedBooking(booking);
                  setShowOtpModal(true);
                }}
              >
                <Text style={styles.otpButtonText}>🔐 Enter OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noShowButton}
                onPress={() => handleNoShow(booking)}
              >
                <Text style={styles.noShowButtonText}>✕ No Show</Text>
              </TouchableOpacity>
            </>
          )}

          {isPicked && (
            <TouchableOpacity
              style={styles.dropButtonFull}
              onPress={() => handleDrop(booking)}
            >
              <Text style={styles.dropButtonText}>✓ Mark as Dropped</Text>
            </TouchableOpacity>
          )}

          {isDropped && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>✓ Completed</Text>
            </View>
          )}

          {isNoShow && (
            <View style={styles.noShowContainer}>
              <Text style={styles.noShowText}>✕ No Show</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Route Details</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Route Summary Card */}
        <View style={styles.routeSummaryCard}>
          <View style={styles.routeIdRow}>
            <View style={styles.routeIdContainer}>
              <Text style={styles.routeIdLabel}>Route ID</Text>
              <Text style={styles.routeIdValue}>#{routeData.route_id}</Text>
            </View>
            <View style={[
              styles.routeTypeBadge,
              routeData.log_type === 'IN' ? styles.pickupTypeBadge : styles.dropTypeBadge
            ]}>
              <Text style={styles.routeTypeIcon}>
                {routeData.log_type === 'IN' ? '🏠' : '🏢'}
              </Text>
              <Text style={styles.routeTypeText}>
                {routeData.log_type === 'IN' ? 'Pickup Route' : 'Drop Route'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.routeDetailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🕐</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Shift Time</Text>
                <Text style={styles.detailValue}>{routeData.shift_time || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>📍</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Total Stops</Text>
                <Text style={styles.detailValue}>{bookings.length}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>📏</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>
                  {routeData.summary?.total_distance_km?.toFixed(1) || '0'} km
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>⏱️</Text>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>
                  {routeData.summary?.total_time_minutes || '0'} min
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Booking Sequence ({bookings.length})</Text>
        
        {bookings.map(booking => renderBookingCard(booking))}
      </ScrollView>

      <Modal
        visible={showOtpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowOtpModal(false);
          setOtp('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowOtpModal(false);
            setOtp('');
          }}
        >
          <View style={styles.otpModal} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.lockIconContainer}>
                <Text style={styles.lockIcon}>🔐</Text>
              </View>
              <Text style={styles.modalTitle}>Enter OTP</Text>
              <Text style={styles.modalSubtitle}>
                Verify employee {selectedBooking?.employee_code}
              </Text>
              <Text style={styles.modalInfo}>
                ID: {selectedBooking?.employee_id}
              </Text>
            </View>

            <View style={styles.otpContainer}>
              {[0, 1, 2, 3].map((index) => (
                <TextInput
                  key={index}
                  ref={otpInputRefs[index]}
                  style={[
                    styles.otpBox,
                    otp[index] && styles.otpBoxFilled
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={otp[index] || ''}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowOtpModal(false);
                  setOtp('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  otp.length !== 4 && styles.submitButtonDisabled
                ]}
                onPress={handleOtpSubmit}
                disabled={submittingOtp || otp.length !== 4}
              >
                {submittingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {otp.length === 4 ? 'Verify ✓' : 'Verify'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Toast 
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={() => setShowToast(false)}
        duration={3000}
      />
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  routeSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  routeIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeIdContainer: {
    flex: 1,
  },
  routeIdLabel: {
    fontSize: 10,
    color: '#636e72',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  routeIdValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  routeTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  pickupTypeBadge: {
    backgroundColor: '#ffeaa7',
  },
  dropTypeBadge: {
    backgroundColor: '#74b9ff',
  },
  routeTypeIcon: {
    fontSize: 14,
  },
  routeTypeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  },
  routeDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    color: '#636e72',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 13,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 10,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sequenceContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sequenceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  bookingInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  employeeId: {
    fontSize: 12,
    color: '#636e72',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingBadge: {
    backgroundColor: '#ffeaa7',
  },
  pickedBadge: {
    backgroundColor: '#74b9ff',
  },
  droppedBadge: {
    backgroundColor: '#55efc4',
  },
  noShowBadge: {
    backgroundColor: '#fab1a0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  locationContainer: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationRowWithNav: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locationMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: '#636e72',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 13,
    color: '#2d3436',
    lineHeight: 18,
    fontWeight: '500',
  },
  navigateIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  navigatorIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 22,
  },
  timingLabel: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '500',
  },
  timingValue: {
    fontSize: 12,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  otpButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  otpButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  noShowButton: {
    flex: 1,
    backgroundColor: '#d63031',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  noShowButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dropButton: {
    flex: 1,
    backgroundColor: '#00b894',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dropButtonFull: {
    flex: 1,
    backgroundColor: '#00b894',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dropButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  completedContainer: {
    flex: 1,
    backgroundColor: '#dfe6e9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  completedText: {
    color: '#2d3436',
    fontSize: 13,
    fontWeight: 'bold',
  },
  noShowContainer: {
    flex: 1,
    backgroundColor: '#dfe6e9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  noShowText: {
    color: '#d63031',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockIcon: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 4,
  },
  modalInfo: {
    fontSize: 12,
    color: '#b2bec3',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  otpBox: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: '#dfe6e9',
    borderRadius: 12,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2d3436',
    backgroundColor: '#f8f9fa',
  },
  otpBoxFilled: {
    borderColor: '#6C63FF',
    backgroundColor: '#f0f0ff',
    transform: [{ scale: 1.05 }],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dfe6e9',
  },
  cancelButtonText: {
    color: '#636e72',
    fontSize: 15,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#b2bec3',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

