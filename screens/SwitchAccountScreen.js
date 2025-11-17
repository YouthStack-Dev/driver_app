import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import sessionService from '../services/sessionService';
import { switchCompany } from '../services/authService';

export default function SwitchAccountScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const session = await sessionService.getSession();
      if (!session || !session.user_data) {
        Alert.alert('Session error', 'No active session found. Please login again.');
        navigation.replace('Login');
        return;
      }

      const userData = session.user_data;
      const accountsList = userData.accounts || [];
      
      // Get current account info
      const current = {
        tenant_id: userData.tenant_id || (userData.account && userData.account.tenant_id),
        vendor_id: userData.vendor_id || (userData.account && userData.account.vendor_id),
      };

      setCurrentAccount(current);
      setAccounts(accountsList);
      setLoading(false);
    } catch (error) {
      console.log('Error loading accounts:', error);
      Alert.alert('Error', 'Failed to load accounts. Please try again.');
      setLoading(false);
    }
  };

  const handleSwitch = async (account) => {
    if (switching) return;

    // Check if already on this account
    if (currentAccount && 
        currentAccount.tenant_id === account.tenant_id && 
        currentAccount.vendor_id === account.vendor_id) {
      Alert.alert('Already Active', 'You are already using this account.');
      return;
    }

    setSwitching(true);
    setSelected(`${account.vendor_id}:${account.tenant_id}`);

    try {
      const session = await sessionService.getSession();
      if (!session || !session.access_token) {
        Alert.alert('Session error', 'No access token found. Please login again.');
        navigation.replace('Login');
        return;
      }

      const result = await switchCompany({
        access_token: session.access_token,
        tenant_id: account.tenant_id,
        vendor_id: account.vendor_id,
      });

      if (result.success) {
        Alert.alert(
          'Success',
          `Switched to ${account.company_name || account.vendor_name || 'selected company'}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to My Rides page
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Rides' }],
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Switch Failed', result.error || 'Unable to switch company. Please try again.');
        setSwitching(false);
        setSelected(null);
      }
    } catch (error) {
      console.log('Error switching company:', error);
      Alert.alert('Error', 'An error occurred while switching. Please try again.');
      setSwitching(false);
      setSelected(null);
    }
  };

  const renderAccount = ({ item }) => {
    const isSelected = selected === `${item.vendor_id}:${item.tenant_id}`;
    const isCurrent = currentAccount && 
                      currentAccount.tenant_id === item.tenant_id && 
                      currentAccount.vendor_id === item.vendor_id;

    return (
      <TouchableOpacity
        style={[
          styles.accountCard,
          isCurrent && styles.accountCardCurrent,
          isSelected && styles.accountCardSelected,
        ]}
        onPress={() => handleSwitch(item)}
        disabled={switching || isCurrent}
        activeOpacity={0.7}
      >
        <View style={styles.accountContent}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountName}>{item.company_name || 'Company'}</Text>
            {isCurrent && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.accountDetail}>Tenant: {item.tenant_id}</Text>
          <Text style={styles.accountDetail}>Vendor: {item.vendor_id}</Text>
        </View>
        
        {isSelected && switching && (
          <ActivityIndicator size="small" color="#6C63FF" style={styles.loader} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading accounts...</Text>
      </View>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No accounts available</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => `${item.vendor_id}:${item.tenant_id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  header: {
    backgroundColor: '#6C63FF',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  listContent: {
    padding: 20,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountCardCurrent: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  accountCardSelected: {
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  accountContent: {
    flex: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  accountDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  currentBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loader: {
    marginLeft: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
