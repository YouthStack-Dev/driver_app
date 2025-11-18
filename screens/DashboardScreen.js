import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationTracker from '../components/LocationTracker';
import logoutService from '../services/logoutService';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

export default function DashboardScreen({ navigation }) {
  const [userInfo, setUserInfo] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnimation = useState(new Animated.Value(-DRAWER_WIDTH))[0];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen]);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      // You can decode the JWT token here to get user info if needed
      // For now, we'll just confirm we have a token
      if (token) {
        setUserInfo({ loggedIn: true });
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Logout initiated from dashboard');
      const result = await logoutService.logout();
      
      if (result.success) {
        console.log('✅ Logout successful, navigating to login');
        navigation.replace('Login');
      } else {
        console.log('⚠️ Logout warning:', result.error);
        // Still navigate to login even if logout had issues
        navigation.replace('Login');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Fallback logout
      await AsyncStorage.removeItem('access_token');
      navigation.replace('Login');
    }
  };

  const toggleDrawer = () => {
    console.log('Toggle drawer clicked, current state:', drawerOpen);
    setDrawerOpen(!drawerOpen);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  return (
    <View style={styles.wrapper}>
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

          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); navigation.navigate('Rides'); }}>
            <Text style={styles.drawerItemText}>🚗 My Rides</Text>
          </TouchableOpacity>
          
          <View style={styles.drawerDivider} />
          
          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); navigation.navigate('SwitchAccount'); }}>
            <Text style={styles.drawerItemText}>🔄 Switch Company</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); navigation.navigate('LocationTest'); }}>
            <Text style={styles.drawerItemText}>🧪 Location Test</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={() => { closeDrawer(); handleLogout(); }}>
            <Text style={[styles.drawerItemText, styles.logoutText]}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header with MLT and Menu Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleDrawer} style={styles.menuButton}>
            <View style={styles.menuIcon}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MLT Dashboard</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.welcomeText}>Welcome to your dashboard!</Text>
        
        {/* Location Tracker Component */}
        <LocationTracker />
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.buttonContainer}>
            <Button title="View Profile" onPress={() => {}} />
          </View>
          <View style={styles.buttonContainer}>
            <Button title="Settings" onPress={() => {}} />
          </View>
        </View>

        <View style={styles.logoutContainer}>
          <Button title="Log Out" onPress={handleLogout} color="#d9534f" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    zIndex: 2,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    marginBottom: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  menuButton: {
    padding: 10,
  },
  menuIcon: {
    width: 30,
    height: 24,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 50,
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  welcomeText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 10,
  },
  logoutContainer: {
    marginTop: 20,
  },
});
