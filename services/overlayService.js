import { NativeModules, Platform } from 'react-native';

const { FloatingOverlay } = NativeModules;

class OverlayService {
  async checkPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      return await FloatingOverlay.checkPermission();
    } catch (error) {
      console.error('Error checking overlay permission:', error);
      return false;
    }
  }

  async requestPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      return await FloatingOverlay.requestPermission();
    } catch (error) {
      console.error('Error requesting overlay permission:', error);
      return false;
    }
  }

  async showOverlay() {
    if (Platform.OS !== 'android') {
      console.log('Overlay not supported on this platform');
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
    if (Platform.OS !== 'android') {
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
