import sessionService from './sessionService';
import locationService from './locationService';

class LogoutService {
  /**
   * Handle complete logout process
   */
  async logout() {
    try {
      console.log('🚪 Starting logout process...');

      // Stop location tracking
      console.log('🛑 Stopping location tracking...');
      const stopResult = await locationService.stopLocationTracking();
      if (stopResult.success) {
        console.log('✅ Location tracking stopped successfully');
      } else {
        console.log('⚠️ Warning: Could not stop location tracking:', stopResult.error);
      }

      // Clear session data
      console.log('🗑️ Clearing session data...');
      await sessionService.clearSession();
      await sessionService.clearTempSession();

      console.log('✅ Logout completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle app backgrounding - optionally pause location tracking
   */
  async handleAppBackground() {
    try {
      // You can choose to pause location tracking when app goes to background
      // or let it continue for real-time tracking
      console.log('📱 App went to background');
      
      // Uncomment the following lines if you want to pause tracking on background
      // const result = await locationService.stopLocationTracking();
      // console.log('🛑 Location tracking paused for background');
      
      return { success: true };
    } catch (error) {
      console.error('❌ App background error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle app foregrounding - resume location tracking
   */
  async handleAppForeground() {
    try {
      console.log('📱 App came to foreground');
      
      // Check if user is still logged in
      const session = await sessionService.getSession();
      if (session?.user_data) {
        console.log('🚀 Resuming location tracking for active session');
        const result = await locationService.startLocationTracking();
        if (result.success) {
          console.log('✅ Location tracking resumed');
        } else {
          console.log('⚠️ Could not resume location tracking:', result.error);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ App foreground error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new LogoutService();