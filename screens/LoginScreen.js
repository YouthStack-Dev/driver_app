import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { login } from '../services/authService'; // call auth service

export default function LoginScreen({ navigation }) {
  const [licenseNumber, setLicenseNumber] = useState('LC123456');
  const [password, setPassword] = useState('StrongPassword123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('=== Driver Login Attempt Started ===');
    setError('');
    setLoading(true);
    
    try {
      const result = await login({ license_number: licenseNumber, password });
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('✓ Driver login successful');
        // New flow: authService stores a short-lived `temp_token` and accounts in temp-session.
        // If multiple accounts were returned, navigate to account selection screen.
        const accounts = result.accounts || [];
        // Always go to SelectAccount so the app can confirm temp_token -> access_token.
        // SelectAccount will auto-confirm when there's only one account returned.
        navigation.navigate('SelectAccount');
      } else {
        console.log('✗ Login failed:', result.error);
        setError(result.error);
      }
    } catch (err) {
      console.log('✗ Unexpected error in handleLogin:', err);
      setError('Unexpected error occurred: ' + err.message);
    } finally {
      setLoading(false);
      console.log('=== Driver Login Attempt Ended ===');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Login</Text>
      <TextInput style={styles.input} placeholder="License Number (DL) or Username" value={licenseNumber} onChangeText={setLicenseNumber} />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {loading ? <ActivityIndicator size="large" /> : <Button title="Log In" onPress={handleLogin} />}
      {error !== '' && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f9f9f9', paddingHorizontal:20 },
  title: { fontSize:28, fontWeight:'bold', marginBottom:30 },
  input: { width:'100%', height:50, borderColor:'#ccc', borderWidth:1, borderRadius:8, paddingHorizontal:15, marginBottom:15, fontSize:16, backgroundColor:'#fff' },
  error: { 
    color:'red', 
    marginTop:10, 
    fontSize:14, 
    textAlign:'center',
    paddingHorizontal:10 
  }
});