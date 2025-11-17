import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import sessionService from '../services/sessionService';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [driverData, setDriverData] = useState(null);
  const [tenantData, setTenantData] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const session = await sessionService.getSession();
      if (!session || !session.user_data) {
        console.log('No session found');
        navigation.replace('Login');
        return;
      }

      const userData = session.user_data;
      const driver = userData.user?.driver || {};
      const tenant = userData.user?.tenant || {};

      setDriverData(driver);
      setTenantData(tenant);
      setLoading(false);
    } catch (error) {
      console.log('Error loading profile:', error);
      setLoading(false);
    }
  };

  const renderSection = (title, items) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.infoRow}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value || 'N/A'}</Text>
        </View>
      ))}
    </View>
  );

  const renderDocumentStatus = (title, status, expiryDate) => {
    const statusColors = {
      Pending: '#FFA500',
      Approved: '#4CAF50',
      Rejected: '#F44336',
      Expired: '#F44336',
    };

    return (
      <View style={styles.documentRow}>
        <Text style={styles.documentLabel}>{title}</Text>
        <View style={styles.documentStatus}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[status] || '#999' }]}>
            <Text style={styles.statusText}>{status || 'N/A'}</Text>
          </View>
          {expiryDate && (
            <Text style={styles.expiryText}>Exp: {expiryDate}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!driverData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Unable to load profile</Text>
        <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {driverData.photo_url ? (
            <Image source={{ uri: driverData.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {driverData.name?.charAt(0)?.toUpperCase() || 'D'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{driverData.name}</Text>
        <Text style={styles.code}>{driverData.code}</Text>
        <Text style={styles.company}>{tenantData?.name}</Text>
      </View>

      {/* Personal Information */}
      {renderSection('Personal Information', [
        { label: 'Email', value: driverData.email },
        { label: 'Phone', value: driverData.phone },
        { label: 'Gender', value: driverData.gender },
        { label: 'Date of Birth', value: driverData.date_of_birth },
        { label: 'Date of Joining', value: driverData.date_of_joining },
      ])}

      {/* Address */}
      {renderSection('Address', [
        { label: 'Current Address', value: driverData.current_address },
        { label: 'Permanent Address', value: driverData.permanent_address },
      ])}

      {/* License & Identification */}
      {renderSection('License & Identification', [
        { label: 'License Number', value: driverData.license_number },
        { label: 'License Expiry', value: driverData.license_expiry_date },
        { label: 'Badge Number', value: driverData.badge_number },
        { label: 'Badge Expiry', value: driverData.badge_expiry_date },
        { label: 'Alt ID Type', value: driverData.alt_govt_id_type },
        { label: 'Alt ID Number', value: driverData.alt_govt_id_number },
      ])}

      {/* Verification Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification Status</Text>
        {renderDocumentStatus('Background Verification', driverData.bg_verify_status, driverData.bg_expiry_date)}
        {renderDocumentStatus('Police Verification', driverData.police_verify_status, driverData.police_expiry_date)}
        {renderDocumentStatus('Medical Verification', driverData.medical_verify_status, driverData.medical_expiry_date)}
        {renderDocumentStatus('Training Verification', driverData.training_verify_status, driverData.training_expiry_date)}
        {renderDocumentStatus('Eye Test', driverData.eye_verify_status, driverData.eye_expiry_date)}
      </View>

      {/* Company Information */}
      {renderSection('Company Information', [
        { label: 'Company', value: tenantData?.name },
        { label: 'Tenant ID', value: tenantData?.tenant_id },
        { label: 'Address', value: tenantData?.address },
        { label: 'Induction Date', value: driverData.induction_date },
      ])}

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  },
  header: {
    backgroundColor: '#6C63FF',
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  code: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 5,
  },
  company: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 15,
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#6C63FF',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  documentLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expiryText: {
    fontSize: 12,
    color: '#666',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 30,
  },
});
