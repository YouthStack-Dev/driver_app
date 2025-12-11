import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Button } from 'react-native';
import sessionService from '../services/sessionService';
import { confirmLogin } from '../services/authService';

export default function SelectAccountScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    let mounted = true;
    sessionService.getTempSession().then((s) => {
      if (!mounted) return;
      if (!s) {
        Alert.alert('Session error', 'No temporary session found. Please login again.');
        navigation.replace('Login');
        return;
      }
      setDriver(s.driver || null);
      setAccounts(s.accounts || []);
      setLoading(false);
    }).catch((e) => {
      console.log('Error reading temp session:', e);
      Alert.alert('Session error', 'Unable to read login session. Please try again.');
      navigation.replace('Login');
    });
    return () => { mounted = false; };
  }, []);

  // Auto-confirm when only one account is present
  useEffect(() => {
    if (!loading && accounts && accounts.length === 1) {
      // small delay so UI can settle
      const t = setTimeout(() => handleSelect(accounts[0], true), 300);
      return () => clearTimeout(t);
    }
  }, [loading, accounts]);

  const handleSelect = async (account, isAuto = false) => {
    // clear any previous confirm error when attempting
    if (!isAuto) setConfirmError(null);
    setLoading(true);
    try {
      const temp = await sessionService.getTempSession();
      if (!temp || !temp.temp_token) {
        Alert.alert('Session error', 'Temporary login session is missing. Please login again.');
        navigation.replace('Login');
        return;
      }

      // call confirm with a couple retries handled inside confirmLogin
      const res = await confirmLogin({ temp_token: temp.temp_token, vendor_id: account.vendor_id, tenant_id: account.tenant_id, retries: 2 });

      if (res.success) {
        setConfirmError(null);
        navigation.replace('Schedules');
        return;
      }

      // map server-side error codes to friendly messages
      const ERROR_MAP = {
        INVALID_TEMP_TOKEN: 'Your login session expired. Please login again.',
        INVALID_LOGIN: 'Invalid license number or password. Please check and try again.',
        INVALID_PASSWORD: 'Invalid password. Please try again.',
        ACCOUNT_NOT_FOUND: 'Selected account not found. Contact support.',
      };

      const friendly = ERROR_MAP[res.errorCode] || res.error || 'Unable to confirm login. Please try again.';

      if (isAuto) {
        // Auto-confirm failed: fall back to manual selection UI
        setSelected(`${account.vendor_id}:${account.tenant_id}`);
        setConfirmError(friendly);
        setLoading(false);
        return;
      }

      Alert.alert('Login error', friendly, [
        { text: 'Retry', onPress: () => handleSelect(account) },
        { text: 'Cancel', style: 'cancel' }
      ]);
    } catch (e) {
      console.log('Error during confirm login:', e);
      if (isAuto) {
        setSelected(`${account.vendor_id}:${account.tenant_id}`);
        setConfirmError('Network error. Please try manually.');
        setLoading(false);
        return;
      }

      Alert.alert('Error', 'Unable to continue. Please try again.', [
        { text: 'Retry', onPress: () => handleSelect(account) },
        { text: 'Cancel', style: 'cancel' }
      ]);
    } finally {
      if (!isAuto) setLoading(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Vendor / Tenant</Text>
      {driver && (
        <View style={styles.driverBox}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <Text style={styles.driverMeta}>{driver.license_number}</Text>
        </View>
      )}

      <FlatList
        data={accounts}
        keyExtractor={(item) => `${item.vendor_id}:${item.tenant_id}`}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.accountRow} onPress={() => setSelected(`${item.vendor_id}:${item.tenant_id}`)}>
            <View>
              <Text style={styles.vendorName}>{item.vendor_name}</Text>
              <Text style={styles.tenantName}>{item.tenant_name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.radio, selected === `${item.vendor_id}:${item.tenant_id}` ? styles.radioSelected : null]} />
            </View>
          </TouchableOpacity>
        )}
      />

      {(accounts.length > 1 || selected) && (
        <View style={{ paddingTop: 12 }}>
          <Button title="Continue with selected account" onPress={() => {
            const parts = (selected || '').split(':');
            const vendorId = parts[0] ? parseInt(parts[0], 10) : null;
            const tenantId = parts[1] || null;
            const account = accounts.find(a => `${a.vendor_id}:${a.tenant_id}` === selected) || accounts[0];
            if (!account) {
              Alert.alert('Select account', 'Please select an account to continue.');
              return;
            }
            handleSelect(account, false);
          }} />
        </View>
      )}
      {confirmError ? (
        <Text style={{ color: 'red', textAlign: 'center', marginTop: 10 }}>{confirmError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20, backgroundColor:'#fff' },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  title: { fontSize:22, fontWeight:'bold', marginBottom:15 },
  driverBox: { padding:12, backgroundColor:'#f1f1f1', borderRadius:8, marginBottom:12 },
  driverName: { fontSize:16, fontWeight:'600' },
  driverMeta: { color:'#666' },
  accountRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14, borderBottomWidth:1, borderColor:'#eee' },
  vendorName: { fontSize:16, fontWeight:'600' },
  tenantName: { color:'#666' },
  cta: { color:'#007AFF', fontWeight:'600' },
  radio: { width:18, height:18, borderRadius:9, borderWidth:1, borderColor:'#ccc', marginLeft:12 },
  radioSelected: { backgroundColor:'#007AFF', borderColor:'#007AFF' }
});
