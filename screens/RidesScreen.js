import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDriverTrips } from '../services/routeService';
import Toast from '../components/Toast';
import CalendarPicker from '../components/CalendarPicker';
import { useFocusEffect } from '@react-navigation/native';
import sessionService from '../services/sessionService';

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
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnimation = useState(new Animated.Value(-280))[0];

  const tabs = [
    { 
      key: 'upcoming', 
      label: 'Upcoming', 
      icon: '🚗'
    },
    { 
      key: 'ongoing', 
      label: 'Ongoing', 
      icon: '🔄'
    },
    { 
      key: 'completed', 
      label: 'Completed', 
      icon: '✓'
    },
  ];

  useEffect(() => {
    loadDriverIdAndRoutes();
  }, []);

  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: drawerOpen ? 0 : -280,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen]);

  useFocusEffect(
    React.useCallback(() => {
      // Re-fetch routes when screen is focused. Include `selectedTab` so
      // we request the correct category (upcoming/ongoing/completed)
      if (driverId) {
        fetchRoutes(selectedTab);
      }
    }, [driverId, selectedTab])
  );

  const loadDriverIdAndRoutes = async () => {
    try {
      const dId = await AsyncStorage.getItem('driver_id');
      if (dId) {
        setDriverId(dId);
        // Set today's date in local timezone
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        console.log('=== Date Info ===');
        console.log('Local Date:', today.toLocaleString());
        console.log('Selected Date String:', dateStr);
        console.log('Timezone Offset (minutes):', today.getTimezoneOffset());
        
        setSelectedDate(dateStr);
        
        await fetchRoutes(selectedTab, dateStr);
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

  const fetchRoutes = async (statusFilter, dateParam = null) => {
    setLoading(true);
    setError('');
    
    const result = await getDriverTrips({
      statusFilter: statusFilter,
      bookingDate: dateParam || selectedDate
    });
    
    if (result.success) {
      setRoutes(result.routes || []);
      setFilteredRoutes(result.routes || []);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleTabChange = (tabKey) => {
    setSelectedTab(tabKey);
    fetchRoutes(tabKey);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (driverId) {
      await fetchRoutes(selectedTab);
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

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Select Date';
    
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selectedDateObj = new Date(date);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    // Check if it's today
    if (selectedDateObj.getTime() === today.getTime()) {
      return 'Today';
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (selectedDateObj.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }
    
    // Check if it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (selectedDateObj.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    fetchRoutes(selectedTab, dateStr);
  };

  const renderRouteCard = (route, index) => {
    const totalStops = route.stops?.length || 0;
    const totalDistance = route.summary?.total_distance_km || 0;
    const totalTime = route.summary?.total_time_minutes || 0;
    const shiftTime = formatTime(route.shift_time);
    
    // Determine pickup/drop based on log_type
    const isPickup = route.log_type === 'IN';
    const routeType = isPickup ? 'Pickup' : 'Drop';
    
    // Get first and last stop for locations
    const firstStop = route.stops?.[0];
    const lastStop = route.stops?.[route.stops?.length - 1];
    
    const pickupLocation = isPickup 
      ? (firstStop?.pickup_location || 'Not specified')
      : (firstStop?.drop_location || 'Office');
    
    const dropLocation = isPickup 
      ? 'Office'
      : (lastStop?.drop_location || 'Not specified');

    return (
      <TouchableOpacity
        key={route.route_id || index}
        style={styles.routeCard}
        onPress={() => {
          navigation.navigate('RideDetails', { routeData: route });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.routeInfoRow}>
              <Text style={styles.routeName}>Route #{route.route_id}</Text>
              <View style={[styles.statusBadge, route.log_type === 'IN' ? styles.pickupBadge : styles.dropBadge]}>
                <Text style={styles.statusText}>{route.log_type === 'IN' ? '🏠' : '🏢'} {routeType}</Text>
              </View>
            </View>
            <Text style={styles.routeTime}>🕐 {shiftTime}</Text>
          </View>

          {/* Locations */}
          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Start</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {pickupLocation}
                </Text>
              </View>
            </View>

            <View style={styles.stopsIndicator}>
              <Text style={styles.stopsText}>{totalStops} stops</Text>
            </View>

            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>🎯</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>End</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {dropLocation}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer Stats */}
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
            <Text style={styles.drawerItemText}>🚗 My Rides</Text>
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
          <Text style={styles.title}>My Rides</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.dateSelector}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateIcon}>📅</Text>
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Picker Modal */}
      <CalendarPicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
      />

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
        <>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const count = tab.key === selectedTab ? filteredRoutes.length : 0;
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
                    {tab.icon} {tab.label}
                  </Text>
                  {selectedTab === tab.key && (
                    <View style={[
                      styles.tabCountBadge,
                      selectedTab === tab.key && styles.tabCountBadgeActive
                    ]}>
                      <Text style={[
                        styles.tabCount,
                        selectedTab === tab.key && styles.tabCountActive
                      ]}>
                        {count}
                      </Text>
                    </View>
                  )}
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
            {filteredRoutes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🚗</Text>
                <Text style={styles.emptyText}>No {selectedTab} routes</Text>
                <Text style={styles.emptySubtext}>
                  {selectedTab === 'upcoming' ? 'Your assigned routes will appear here' : 'No routes in this category'}
                </Text>
              </View>
            ) : (
              filteredRoutes.map((route, index) => renderRouteCard(route, index))
            )}
          </ScrollView>
        </>
      )}
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
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
});
