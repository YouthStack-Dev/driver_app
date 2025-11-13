import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen({ navigation }) {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

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
    await AsyncStorage.removeItem('access_token');
    navigation.replace('Login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.welcomeText}>Welcome to your dashboard!</Text>
      
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
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
