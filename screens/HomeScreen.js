import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import sessionService from '../services/sessionService';

export default function HomeScreen({ navigation }) {
  const handleLogout = async () => {
    await sessionService.clearSession();
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Home Screen</Text>
      <Button title="Log Out" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f9f9f9', 
    paddingHorizontal: 20 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 30 
  }
});
