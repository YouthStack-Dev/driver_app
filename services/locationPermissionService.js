import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { AppState } from 'react-native';

class LocationPermissionService {
  constructor() {
    this.permissionCheckInterval = null;
    this.appStateSubscription = null;
    this.isMonitoring = false;
    this.onPermissionChange = null;
  }

  /**
   * Initialize permission monitoring
   */
  async initialize(onPermissionChangeCallback = null) {
    this.onPermissionChange = onPermissionChangeCallback;
    
    // Start monitoring app state changes
    this.startAppStateMonitoring();
    
    // Initial permission check
    const hasPermissions = await this.checkAndRequestPermissions();
    return hasPermissions;
  }

  /**
   * Check current permission status
   */
  async getCurrentPermissionStatus() {
    try {
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      
      return {
        foreground: {
          granted: foregroundStatus.granted,
          status: foregroundStatus.status,
          canAskAgain: foregroundStatus.canAskAgain
        },
        background: {
          granted: backgroundStatus.granted,
          status: backgroundStatus.status,
          canAskAgain: backgroundStatus.canAskAgain
        },
        hasAll: foregroundStatus.granted && backgroundStatus.granted
      };
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
      return {
        foreground: { granted: false, status: 'undetermined', canAskAgain: true },
        background: { granted: false, status: 'undetermined', canAskAgain: true },
        hasAll: false
      };
    }
  }

  /**
   * Request location permissions with user-friendly prompts
   */
  async checkAndRequestPermissions(showAlert = true) {
    try {
      console.log('🔍 Checking location permissions...');
      
      // Check current status first
      const currentStatus = await this.getCurrentPermissionStatus();
      
      if (currentStatus.hasAll) {
        console.log('✅ All location permissions already granted');
        return { success: true, permissions: currentStatus };
      }

      // Request foreground permission first
      if (!currentStatus.foreground.granted) {
        if (showAlert) {
          await this.showPermissionExplanation('foreground');
        }
        
        console.log('📱 Requesting foreground location permission...');
        const foregroundResult = await Location.requestForegroundPermissionsAsync();
        
        if (!foregroundResult.granted) {
          if (!foregroundResult.canAskAgain) {
            this.showSettingsAlert('foreground');
          }
          return { 
            success: false, 
            error: 'Foreground location permission denied',
            permissions: await this.getCurrentPermissionStatus()
          };
        }
      }

      // Request background permission
      if (showAlert) {
        await this.showPermissionExplanation('background');
      }
      
      console.log('🌍 Requesting background location permission...');
      const backgroundResult = await Location.requestBackgroundPermissionsAsync();
      
      if (!backgroundResult.granted) {
        if (!backgroundResult.canAskAgain) {
          this.showSettingsAlert('background');
        }
        return { 
          success: false, 
          error: 'Background location permission denied',
          permissions: await this.getCurrentPermissionStatus()
        };
      }

      const finalStatus = await this.getCurrentPermissionStatus();
      console.log('✅ All location permissions granted successfully');
      
      return { success: true, permissions: finalStatus };
      
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { 
        success: false, 
        error: error.message,
        permissions: await this.getCurrentPermissionStatus()
      };
    }
  }

  /**
   * Show user-friendly explanation before requesting permissions
   */
  async showPermissionExplanation(type) {
    return new Promise((resolve) => {
      const title = type === 'foreground' 
        ? '📍 Location Access Required'
        : '🌍 Background Location Required';
        
      const message = type === 'foreground'
        ? 'This app needs location access to track your position and provide driver services. Your location will be used to:\n\n• Update your current position\n• Help passengers find you\n• Optimize route planning'
        : 'To continue tracking your location while the app is in the background, please allow "Allow all the time" when prompted.\n\nThis ensures continuous service delivery.';

      Alert.alert(
        title,
        message,
        [
          { 
            text: 'Cancel', 
            onPress: () => resolve(false),
            style: 'cancel'
          },
          { 
            text: 'Grant Permission', 
            onPress: () => resolve(true)
          }
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show alert to open settings when permissions can't be requested
   */
  showSettingsAlert(type) {
    const title = type === 'background' 
      ? '🌍 Background Location Required'
      : '📍 Location Access Required';
      
    const message = 'Location permission was denied. To use location features, please:\n\n1. Open Settings\n2. Find this app\n3. Enable Location permissions\n4. Select "Allow all the time" for background location';

    Alert.alert(
      title,
      message,
      [
        { text: 'Later', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  /**
   * Start monitoring app state changes to detect permission changes
   */
  startAppStateMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking permissions...');
        await this.checkPermissionChanges();
      }
    });
    
    // Also check permissions periodically when app is active
    this.startPeriodicCheck();
  }

  /**
   * Check for permission changes
   */
  async checkPermissionChanges() {
    const currentStatus = await this.getCurrentPermissionStatus();
    
    if (!currentStatus.hasAll && this.onPermissionChange) {
      console.log('⚠️ Location permissions were revoked');
      this.onPermissionChange(currentStatus);
    }
    
    return currentStatus;
  }

  /**
   * Start periodic permission checking (every 30 seconds)
   */
  startPeriodicCheck() {
    if (this.permissionCheckInterval) {
      clearInterval(this.permissionCheckInterval);
    }
    
    this.permissionCheckInterval = setInterval(async () => {
      if (AppState.currentState === 'active') {
        await this.checkPermissionChanges();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    if (this.permissionCheckInterval) {
      clearInterval(this.permissionCheckInterval);
      this.permissionCheckInterval = null;
    }
  }

  /**
   * Show location permission required alert for specific feature
   */
  showFeatureBlockedAlert(featureName = 'this feature') {
    Alert.alert(
      '📍 Location Required',
      `Location access is required to use ${featureName}. Please grant location permissions in app settings.`,
      [
        { text: 'Later', style: 'cancel' },
        { 
          text: 'Grant Permission',
          onPress: () => this.checkAndRequestPermissions()
        },
        { 
          text: 'Settings', 
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  /**
   * Check if location services are enabled on device
   */
  async checkLocationServicesEnabled() {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert(
          '📍 Location Services Disabled',
          'Please enable Location Services in your device settings to use location features.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
      return enabled;
    } catch (error) {
      console.error('❌ Error checking location services:', error);
      return false;
    }
  }
}

// Create singleton instance
const locationPermissionService = new LocationPermissionService();
export default locationPermissionService;