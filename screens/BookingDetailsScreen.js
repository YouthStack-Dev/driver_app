import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getBookingDetails, cancelBooking } from '../services/bookingService';
import Toast from '../components/Toast';

export default function BookingDetailsScreen({ route, navigation }) {
  const { bookingId } = route.params;
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, []);

  const loadBookingDetails = async () => {
    setLoading(true);
    setError('');
    
    const result = await getBookingDetails(bookingId);
    
    if (result.success) {
      setBooking(result.booking);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const showErrorToast = (message) => {
    setToastMessage(message);
    setToastType('error');
    setShowToast(true);
  };

  const showSuccessToast = (message) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking #${bookingId}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: confirmCancelBooking
        }
      ]
    );
  };

  const confirmCancelBooking = async () => {
    setCancelling(true);
    setShowToast(false);

    try {
      const result = await cancelBooking(bookingId);

      if (result.success) {
        showSuccessToast('Booking cancelled successfully');
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      } else {
        showErrorToast(result.error);
      }
    } catch (err) {
      showErrorToast('Failed to cancel booking. Please try again.');
      console.log('Cancel error:', err);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadBookingDetails}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bookingDate = new Date(booking.booking_date);
  const formattedDate = bookingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const statusColors = {
    'Request': '#fdcb6e',
    'Scheduled': '#74b9ff',
    'Ongoing': '#a29bfe',
    'Completed': '#00b894',
    'Cancelled': '#636e72',
    'No-Show': '#e17055',
  };

  const statusColor = statusColors[booking.status] || '#6C63FF';
  const canCancel = booking.status === 'Request' || booking.status === 'Scheduled';

  return (
    <View style={styles.container}>
      <Toast 
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={() => setShowToast(false)}
        duration={3000}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.bookingId}>Booking #{booking.booking_id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {booking.status}
              </Text>
            </View>
          </View>
          <Text style={styles.bookingDate}>📅 {formattedDate}</Text>
          <Text style={styles.employeeCode}>👤 {booking.employee_code}</Text>
        </View>

        {/* Location Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Location Details</Text>
          
          <View style={styles.locationContainer}>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Pickup Location</Text>
              <Text style={styles.locationText}>{booking.pickup_location}</Text>
              <Text style={styles.coordinates}>
                📍 {booking.pickup_latitude?.toFixed(6)}, {booking.pickup_longitude?.toFixed(6)}
              </Text>
            </View>

            <View style={styles.locationDivider} />

            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Drop Location</Text>
              <Text style={styles.locationText}>{booking.drop_location}</Text>
              <Text style={styles.coordinates}>
                🎯 {booking.drop_latitude?.toFixed(6)}, {booking.drop_longitude?.toFixed(6)}
              </Text>
            </View>
          </View>
        </View>

        {/* Booking Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ Booking Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shift ID</Text>
            <Text style={styles.infoValue}>{booking.shift_id}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Team ID</Text>
            <Text style={styles.infoValue}>{booking.team_id}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tenant ID</Text>
            <Text style={styles.infoValue}>{booking.tenant_id}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Active</Text>
            <Text style={[styles.infoValue, booking.is_active ? styles.activeYes : styles.activeNo]}>
              {booking.is_active ? '✓ Yes' : '✗ No'}
            </Text>
          </View>
        </View>

        {/* OTP Section */}
        {booking.OTP && (
          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>🔐 Your OTP</Text>
            <Text style={styles.otpValue}>{booking.OTP}</Text>
            <Text style={styles.otpHint}>Share this with your driver</Text>
          </View>
        )}

        {/* Reason Section */}
        {booking.reason && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>📝 Reason</Text>
            <Text style={styles.reasonText}>{booking.reason}</Text>
          </View>
        )}

        {/* Timestamps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏱️ Timeline</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created At</Text>
            <Text style={styles.infoValue}>
              {new Date(booking.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Updated At</Text>
            <Text style={styles.infoValue}>
              {new Date(booking.updated_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity 
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            onPress={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#d63031" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel This Booking</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#636e72',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 16,
    color: '#d63031',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  headerCard: {
    backgroundColor: '#6C63FF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingDate: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 5,
  },
  employeeCode: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationContainer: {
    gap: 15,
  },
  locationItem: {
    gap: 5,
  },
  locationLabel: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 15,
    color: '#2d3436',
    fontWeight: '500',
    lineHeight: 22,
  },
  coordinates: {
    fontSize: 12,
    color: '#b2bec3',
    fontFamily: 'monospace',
  },
  locationDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  infoLabel: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  activeYes: {
    color: '#00b894',
  },
  activeNo: {
    color: '#d63031',
  },
  otpCard: {
    backgroundColor: '#f0efff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  otpLabel: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '600',
    marginBottom: 10,
  },
  otpValue: {
    fontSize: 32,
    color: '#6C63FF',
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 8,
  },
  otpHint: {
    fontSize: 12,
    color: '#636e72',
    fontStyle: 'italic',
  },
  reasonCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  reasonLabel: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d63031',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#d63031',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
