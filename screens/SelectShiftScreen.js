import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveShifts } from '../services/shiftService';
import { getWeekoffConfig } from '../services/weekoffService';
import { createBooking } from '../services/bookingService';
import Toast from '../components/Toast';

export default function SelectShiftScreen({ route, navigation }) {
  const { selectionMode, selectedDates, startDate, endDate, daysCount } = route.params;
  
  const [shifts, setShifts] = useState({ in: [], out: [], all: [] });
  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftType, setShiftType] = useState('in');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [weekoffDays, setWeekoffDays] = useState([]);

  useEffect(() => {
    loadShiftsAndWeekoff();
  }, []);

  const loadShiftsAndWeekoff = async () => {
    setLoading(true);
    
    // Load weekoff days
    try {
      const weekoffResult = await getWeekoffConfig();
      if (weekoffResult.success) {
        setWeekoffDays(weekoffResult.weekoffDays || []);
      }
    } catch (err) {
      console.log('Error loading weekoff:', err);
    }
    
    // Load shifts
    const result = await getActiveShifts();
    if (result.success) {
      setShifts(result.shifts);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleShiftSelect = (shift) => {
    setSelectedShift(shift);
  };

  const switchShiftType = (type) => {
    setShiftType(type);
    setSelectedShift(null); // Clear selection when switching tabs
  };

  const renderShiftCard = (shift) => {
    const isSelected = selectedShift?.shift_id === shift.shift_id;
    const isPickup = shift.log_type === 'IN';
    
    return (
      <TouchableOpacity
        key={shift.shift_id}
        style={[styles.shiftCard, isSelected && styles.selectedShiftCard]}
        onPress={() => handleShiftSelect(shift)}
      >
        <View style={styles.shiftHeader}>
          <View style={[styles.shiftBadge, isPickup ? styles.pickupBadge : styles.dropBadge]}>
            <Text style={styles.shiftBadgeText}>
              {isPickup ? '🏠 Pickup' : '🏢 Drop'}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.shiftCode}>{shift.shift_code}</Text>
        <Text style={styles.shiftTime}>⏰ {shift.shift_time}</Text>
        
        <View style={styles.shiftDetails}>
          <Text style={styles.shiftDetailText}>
            👤 {shift.gender || 'Any'}
          </Text>
          <Text style={styles.shiftDetailText}>
            📍 {shift.pickup_type}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isWeekoffDay = (date) => {
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];
    return weekoffDays.includes(dayName);
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const formatBookingDates = () => {
    if (selectionMode === 'single') {
      // Parse date strings properly and format as YYYY-MM-DD
      return selectedDates.map(dateStr => {
        // dateStr is already in YYYY-MM-DD format from CreateBookingScreen
        return dateStr;
      });
    } else {
      // Generate dates from range, excluding weekoff days and past dates
      const dates = [];
      // Parse the date strings properly
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      
      const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      const end = new Date(endYear, endMonth - 1, endDay, 0, 0, 0, 0);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        
        // Only include non-weekoff, non-past days
        if (!isWeekoffDay(currentDate) && !isPastDate(currentDate)) {
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          dates.push(`${year}-${month}-${day}`);
        }
      }
      
      console.log('Formatted booking dates:', dates);
      return dates;
    }
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

  const handleContinue = async () => {
    if (!selectedShift || submitting) return; // Prevent multiple submissions
    
    setSubmitting(true);
    setError('');
    setShowToast(false); // Hide any existing toast

    try {
      const tenantId = await AsyncStorage.getItem('tenant_id');
      const employeeId = await AsyncStorage.getItem('employee_id');
      
      if (!tenantId || !employeeId) {
        showErrorToast('Missing user information. Please login again.');
        setSubmitting(false);
        return;
      }

      const bookingDates = formatBookingDates();
      
      if (bookingDates.length === 0) {
        showErrorToast('No valid booking dates available. Please select future dates.');
        setSubmitting(false);
        return;
      }
      
      console.log('Final booking dates to send:', bookingDates);
      
      const result = await createBooking({
        tenantId,
        employeeId: parseInt(employeeId),
        bookingDates,
        shiftId: selectedShift.shift_id,
      });

      if (result.success) {
        showSuccessToast('Booking created successfully!');
        // Navigate after a short delay to let user see the success toast
        setTimeout(() => {
          navigation.replace('BookingSuccess', {
            bookingId: result.bookingId,
            status: result.status,
            message: result.message,
            daysCount: bookingDates.length,
          });
        }, 1000);
      } else {
        showErrorToast(result.error);
        setSubmitting(false); // Re-enable button on error
      }
    } catch (err) {
      showErrorToast('An error occurred. Please try again.');
      console.log('Submit error:', err);
      setSubmitting(false); // Re-enable button on error
    }
    // Note: Don't set submitting to false on success since we're navigating away
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading shifts...</Text>
      </View>
    );
  }

  const currentShifts = shiftType === 'in' ? shifts.in : shifts.out;
  const hasShifts = currentShifts.length > 0;

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
        <View style={styles.header}>
          <Text style={styles.title}>Select Your Shift</Text>
          <Text style={styles.subtitle}>
            Choose the shift timing for your {daysCount} day booking
          </Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Shift Type Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, shiftType === 'in' && styles.activeTab]}
            onPress={() => switchShiftType('in')}
          >
            <Text style={[styles.tabText, shiftType === 'in' && styles.activeTabText]}>
              🌅 Login (Pickup)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, shiftType === 'out' && styles.activeTab]}
            onPress={() => switchShiftType('out')}
          >
            <Text style={[styles.tabText, shiftType === 'out' && styles.activeTabText]}>
              🌆 Logout (Drop)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shift Type Description */}
        <View style={styles.typeDescription}>
          <Text style={styles.typeDescText}>
            {shiftType === 'in' 
              ? 'Select your morning shift for pickup from home to office'
              : 'Select your evening shift for drop from office to home'}
          </Text>
        </View>

        {/* Shifts List */}
        {hasShifts ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {shiftType === 'in' ? 'Available Morning Shifts' : 'Available Evening Shifts'}
            </Text>
            <View style={styles.shiftsGrid}>
              {currentShifts.map(shift => renderShiftCard(shift))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No {shiftType === 'in' ? 'login' : 'logout'} shifts available
            </Text>
            <Text style={styles.emptySubtext}>
              Try selecting {shiftType === 'in' ? 'logout' : 'login'} shifts or contact your administrator
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, (!selectedShift || submitting) && styles.continueButtonDisabled]}
          disabled={!selectedShift || submitting}
          onPress={handleContinue}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>
              {selectedShift ? `Book ${selectedShift.shift_code}` : 'Select a Shift'}
            </Text>
          )}
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
  scrollContent: {
    paddingBottom: 100,
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
    lineHeight: 20,
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
    marginTop: 10,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 15,
  },
  shiftsGrid: {
    gap: 15,
  },
  shiftCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 18,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedShiftCard: {
    borderColor: '#6C63FF',
    backgroundColor: '#f0efff',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shiftCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 8,
  },
  shiftTime: {
    fontSize: 18,
    color: '#6C63FF',
    fontWeight: '600',
    marginBottom: 12,
  },
  shiftDetails: {
    flexDirection: 'row',
    gap: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  shiftDetailText: {
    fontSize: 14,
    color: '#636e72',
  },
  emptyState: {
    alignItems: 'center',
    padding: 50,
    marginTop: 50,
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
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  continueButton: {
    backgroundColor: '#6C63FF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#b2bec3',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#6C63FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636e72',
  },
  activeTabText: {
    color: '#fff',
  },
  typeDescription: {
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
  },
  typeDescText: {
    fontSize: 13,
    color: '#636e72',
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: '#ffe5e5',
    margin: 20,
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
});
