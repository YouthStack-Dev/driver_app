import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { login } from '../services/authService'; // call auth service
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }) {
  const [tenantId, setTenantId] = useState('SAM001');
  const [username, setUsername] = useState('emp2@emp.com');
  const [password, setPassword] = useState('Employee@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('=== Login Attempt Started ===');
    setError('');
    setLoading(true);
    
    try {
      const result = await login({ tenantId, username, password });
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('✓ Login successful, storing token');
        await AsyncStorage.setItem('access_token', result.access_token);
        await AsyncStorage.setItem('tenant_id', tenantId);
        if (result.employee_id) {
          await AsyncStorage.setItem('employee_id', result.employee_id.toString());
        }
        navigation.replace('Schedules');
      } else {
        console.log('✗ Login failed:', result.error);
        setError(result.error);
      }
    } catch (err) {
      console.log('✗ Unexpected error in handleLogin:', err);
      setError('Unexpected error occurred: ' + err.message);
    } finally {
      setLoading(false);
      console.log('=== Login Attempt Ended ===');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput style={styles.input} placeholder="Tenant ID" value={tenantId} onChangeText={setTenantId} />
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
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