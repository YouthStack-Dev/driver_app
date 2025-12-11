import { NativeModules, Platform } from 'react-native';

const { FloatingOverlay } = NativeModules || {};
const isOverlayAvailable = Platform.OS === 'android' && !!FloatingOverlay;

class OverlayService {
  async checkPermission() {
    if (!isOverlayAvailable) {
      // No native overlay available (Expo), consider permission as granted for testing
      return true;
    }
    try {
      return await FloatingOverlay.checkPermission();
    } catch (error) {
      console.warn('Error checking overlay permission:', error);
      return false;
    }
  }

  async requestPermission() {
    if (!isOverlayAvailable) {
      // Nothing to request in Expo, treat as success
      return true;
    }
    try {
      return await FloatingOverlay.requestPermission();
    } catch (error) {
      console.warn('Error requesting overlay permission:', error);
      return false;
    }
  }

  async showOverlay() {
    if (!isOverlayAvailable) {
      // No overlay available - noop in Expo
      return false;
    }
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('Overlay permission not granted');
        return false;
      }
      await FloatingOverlay.showOverlay();
      return true;
    } catch (error) {
      console.error('Error showing overlay:', error);
      return false;
    }
  }

  async hideOverlay() {
    if (!isOverlayAvailable) {
      // No overlay available - noop in Expo
      return true;
    }
    try {
      await FloatingOverlay.hideOverlay();
      return true;
    } catch (error) {
      console.error('Error hiding overlay:', error);
      return false;
    }
  }
}

export default new OverlayService();
