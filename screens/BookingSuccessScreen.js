import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

function BookingSuccessScreen({ route, navigation }) {
  const { bookingId, status, message, daysCount } = route.params;

  const handleGoToSchedules = () => {
    navigation.navigate('Schedules');
  };

  return (
    <View style={styles.container}>
      <View style={styles.successIcon}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={styles.title}>Booking Submitted!</Text>
      {bookingId && (
        <Text style={styles.bookingIdHighlight}>Booking ID: #{bookingId}</Text>
      )}
      <Text style={styles.message}>{message}</Text>

      <View style={styles.detailsCard}>
        {bookingId && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Booking ID:</Text>
            <Text style={styles.detailValue}>#{bookingId}</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, styles.statusBadge]}>{status}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Days Booked:</Text>
          <Text style={styles.detailValue}>{daysCount} day{daysCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ️ Your booking request has been submitted successfully. 
          You'll be notified once it's approved.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={handleGoToSchedules}
      >
        <Text style={styles.continueButtonText}>View My Bookings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00b894',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#00b894',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#636e72',
    marginBottom: 30,
    textAlign: 'center',
  },
  bookingIdHighlight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 10,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  statusBadge: {
    color: '#6C63FF',
    backgroundColor: '#f0efff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoBox: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00b894',
    marginBottom: 30,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#2d3436',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default BookingSuccessScreen;
