import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBooking } from '../services/bookingService';

function BookingConfirmationScreen({ route, navigation }) {
  const { selectionMode, selectedDates, startDate, endDate, daysCount, shift } = route.params;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatBookingDates = () => {
    if (selectionMode === 'single') {
      return selectedDates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      });
    } else {
      // Generate dates from range
      const dates = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d).toISOString().split('T')[0]);
      }
      return dates;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const tenantId = await AsyncStorage.getItem('tenant_id');
      const employeeId = await AsyncStorage.getItem('employee_id');
      
      if (!tenantId || !employeeId) {
        setError('Missing user information. Please login again.');
        setLoading(false);
        return;
      }

      const bookingDates = formatBookingDates();
      
      const result = await createBooking({
        tenantId,
        employeeId: parseInt(employeeId),
        bookingDates,
        shiftId: shift.shift_id,
      });

      if (result.success) {
        // Navigate to success screen
        navigation.replace('BookingSuccess', {
          bookingId: result.bookingId,
          status: result.status,
          message: result.message,
          daysCount,
        });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.log('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayDates = selectionMode === 'single' 
    ? selectedDates.map(d => new Date(d))
    : [new Date(startDate), new Date(endDate)];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Confirm Your Booking</Text>
        <Text style={styles.subtitle}>Review your booking details before submitting</Text>
      </View>

      {/* Booking Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📅 Booking Details</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>
            {selectionMode === 'single' ? 'Specific Dates' : 'Date Range'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Total Days:</Text>
          <Text style={styles.value}>{daysCount} day{daysCount !== 1 ? 's' : ''}</Text>
        </View>

        {selectionMode === 'single' ? (
          <View style={styles.summarySection}>
            <Text style={styles.label}>Selected Dates:</Text>
            {displayDates.sort((a, b) => a - b).map((date, index) => (
              <Text key={index} style={styles.dateItem}>
                • {date.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>From:</Text>
              <Text style={styles.value}>
                {displayDates[0].toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>To:</Text>
              <Text style={styles.value}>
                {displayDates[1].toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Shift Details */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>🚗 Shift Details</Text>
        
        <View style={styles.shiftInfo}>
          <View style={[styles.shiftBadge, shift.log_type === 'IN' ? styles.pickupBadge : styles.dropBadge]}>
            <Text style={styles.shiftBadgeText}>
              {shift.log_type === 'IN' ? '🏠 Pickup' : '🏢 Drop'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Shift Code:</Text>
          <Text style={styles.value}>{shift.shift_code}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Time:</Text>
          <Text style={styles.value}>⏰ {shift.shift_time}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Pickup Type:</Text>
          <Text style={styles.value}>{shift.pickup_type}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#636e72',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summarySection: {
    marginTop: 10,
  },
  label: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#2d3436',
    fontWeight: 'bold',
  },
  dateItem: {
    fontSize: 14,
    color: '#2d3436',
    marginLeft: 10,
    marginTop: 5,
  },
  shiftInfo: {
    marginBottom: 15,
  },
  shiftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pickupBadge: {
    backgroundColor: '#ffeaa7',
  },
  dropBadge: {
    backgroundColor: '#74b9ff',
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2d3436',
  },
  errorCard: {
    backgroundColor: '#ffe5e5',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d63031',
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  backButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  backButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 2,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#b2bec3',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BookingConfirmationScreen;
