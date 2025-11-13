import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEmployeeBookings, cancelBooking } from '../services/bookingService';
import Toast from '../components/Toast';
import { useFocusEffect } from '@react-navigation/native';

export default function SchedulesScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedTab, setSelectedTab] = useState('active');

  const tabs = [
    { 
      key: 'active', 
      label: 'Active', 
      statuses: ['Ongoing', 'Scheduled', 'Request'],
      icon: '🔄'
    },
    { 
      key: 'completed', 
      label: 'Completed', 
      statuses: ['Completed', 'No-Show'],
      icon: '✓'
    },
    { 
      key: 'cancelled', 
      label: 'Cancelled', 
      statuses: ['Cancelled'],
      icon: '✕'
    },
  ];

  useEffect(() => {
    loadEmployeeIdAndBookings();
  }, []);

  // Add focus effect to refresh when returning to screen
  useFocusEffect(
    React.useCallback(() => {
      if (employeeId) {
        fetchBookings(employeeId);
      }
    }, [employeeId])
  );

  const loadEmployeeIdAndBookings = async () => {
    try {
      const empId = await AsyncStorage.getItem('employee_id');
      if (empId) {
        setEmployeeId(empId);
        await fetchBookings(empId);
      } else {
        setError('Employee ID not found. Please login again.');
        setLoading(false);
      }
    } catch (error) {
      console.log('Error loading data:', error);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const fetchBookings = async (empId) => {
    setLoading(true);
    setError('');
    
    const result = await getEmployeeBookings({
      employeeId: empId,
      skip: 0,
      limit: 100,
    });

    if (result.success) {
      setBookings(result.bookings || []);
      filterBookingsByTab(result.bookings || [], selectedTab);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const filterBookingsByTab = (allBookings, tabKey) => {
    const currentTab = tabs.find(t => t.key === tabKey);
    if (!currentTab) return;

    const filtered = allBookings.filter(booking => 
      currentTab.statuses.includes(booking.status)
    );
    
    // Sort by status order defined in the tab
    filtered.sort((a, b) => {
      const indexA = currentTab.statuses.indexOf(a.status);
      const indexB = currentTab.statuses.indexOf(b.status);
      return indexA - indexB;
    });
    
    setFilteredBookings(filtered);
  };

  const handleTabChange = (tabKey) => {
    setSelectedTab(tabKey);
    filterBookingsByTab(bookings, tabKey);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (employeeId) {
      await fetchBookings(employeeId);
    }
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('access_token');
    navigation.replace('Login');
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

  const handleCancelBooking = (booking) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking #${booking.booking_id}?`,
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => confirmCancelBooking(booking.booking_id)
        }
      ]
    );
  };

  const confirmCancelBooking = async (bookingId) => {
    setCancellingId(bookingId);
    setShowToast(false);

    try {
      const result = await cancelBooking(bookingId);

      if (result.success) {
        showSuccessToast('Booking cancelled successfully');
        setTimeout(() => {
          if (employeeId) {
            fetchBookings(employeeId);
          }
        }, 1000);
      } else {
        showErrorToast(result.error);
      }
    } catch (err) {
      showErrorToast('Failed to cancel booking. Please try again.');
      console.log('Cancel error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const renderBookingCard = (booking, index) => {
    const bookingDate = new Date(booking.booking_date);
    const formattedDate = bookingDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const statusColors = {
      'Request': '#fdcb6e',
      'Approved': '#00b894',
      'Rejected': '#d63031',
      'Completed': '#74b9ff',
      'Cancelled': '#636e72',
    };

    const statusColor = statusColors[booking.status] || '#6C63FF';
    const canCancel = booking.status === 'Request' || booking.status === 'Approved';
    const isCancelling = cancellingId === booking.booking_id;

    return (
      <TouchableOpacity
        key={booking.booking_id || index}
        style={styles.bookingCard}
        onPress={() => navigation.navigate('BookingDetails', { bookingId: booking.booking_id })}
        activeOpacity={0.7}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.bookingId}>#{booking.booking_id}</Text>
            <Text style={styles.bookingDate}>📅 {formattedDate}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.bookingStatus, { color: statusColor }]}>
              {booking.status}
            </Text>
          </View>
        </View>

        <View style={styles.bookingBody}>
          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {booking.pickup_location || 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>🎯</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Drop</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {booking.drop_location || 'Not specified'}
                </Text>
              </View>
            </View>
          </View>

          {booking.OTP && (
            <View style={styles.otpSection}>
              <Text style={styles.otpLabel}>OTP</Text>
              <Text style={styles.otpValue}>{booking.OTP}</Text>
            </View>
          )}

          {canCancel && (
            <TouchableOpacity 
              style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
              onPress={() => handleCancelBooking(booking)}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="#d63031" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Toast 
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={() => setShowToast(false)}
        duration={3000}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Schedules</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <View style={styles.logoutIcon}>
            <Text style={styles.logoutIconText}>⎋</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const count = bookings.filter(b => tab.statuses.includes(b.status)).length;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabButton,
                    selectedTab === tab.key && styles.tabButtonActive
                  ]}
                  onPress={() => handleTabChange(tab.key)}
                >
                  <Text style={[
                    styles.tabLabel,
                    selectedTab === tab.key && styles.tabLabelActive
                  ]}>
                    {tab.label}
                  </Text>
                  <Text style={[
                    styles.tabCount,
                    selectedTab === tab.key && styles.tabCountActive
                  ]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <Text style={styles.sectionTitle}>
              {tabs.find(t => t.key === selectedTab)?.label} Bookings ({filteredBookings.length})
            </Text>
            
            {filteredBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No {selectedTab} bookings found</Text>
                <Text style={styles.emptySubtext}>
                  {selectedTab === 'active' ? 'Create a new booking to get started' : 'Your bookings will appear here'}
                </Text>
              </View>
            ) : (
              filteredBookings.map((booking, index) => renderBookingCard(booking, index))
            )}
          </ScrollView>
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBooking')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutIconText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2d3436',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    paddingBottom: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flex: 1,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 3,
  },
  bookingDate: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  bookingStatus: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingBody: {
    padding: 12,
  },
  locationSection: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
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
    lineHeight: 18,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#dfe6e9',
    marginLeft: 8,
    marginVertical: 6,
  },
  otpSection: {
    backgroundColor: '#f0efff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: 11,
    color: '#636e72',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  otpValue: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d63031',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#d63031',
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    marginTop: 30,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  fabText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#6C63FF',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636e72',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C63FF',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    textAlign: 'center',
  },
  tabCountActive: {
    color: '#6C63FF',
    backgroundColor: '#fff',
  },
});
