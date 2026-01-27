import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';
import { ENV_CONFIG } from '../constants/environment';

/**
 * Crashlytics Service
 * Provides a wrapper around Firebase Crashlytics for crash reporting and logging
 */
class CrashlyticsService {
  private initialized: boolean = false;

  /**
   * Initialize Crashlytics
   * Should be called after Firebase is initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Crashlytics already initialized');
      return;
    }

    try {
      // Enable Crashlytics collection (disabled by default in debug mode)
      // In production, Crashlytics is automatically enabled
      if (__DEV__) {
        // Enable crash reporting in debug mode for testing
        await crashlytics().setCrashlyticsCollectionEnabled(true);
        console.log('Crashlytics enabled for debug mode');
      }

      // Set user identifier (optional - set when user logs in)
      // await crashlytics().setUserId('user-123');

      this.initialized = true;
      console.log('Crashlytics initialized successfully');
    } catch (error) {
      console.error('Error initializing Crashlytics:', error);
      throw error;
    }
  }

  /**
   * Log a message to Crashlytics
   * @param message - Message to log
   */
  log(message: string): void {
    try {
      crashlytics().log(message);
    } catch (error) {
      console.error('Error logging to Crashlytics:', error);
    }
  }

  /**
   * Set a custom attribute
   * @param key - Attribute key
   * @param value - Attribute value
   */
  setAttribute(key: string, value: string | number | boolean): void {
    try {
      crashlytics().setAttribute(key, String(value));
    } catch (error) {
      console.error('Error setting Crashlytics attribute:', error);
    }
  }

  /**
   * Set user identifier
   * @param userId - User ID string
   */
  setUserId(userId: string): void {
    try {
      crashlytics().setUserId(userId);
    } catch (error) {
      console.error('Error setting Crashlytics user ID:', error);
    }
  }

  /**
   * Record a non-fatal error
   * @param error - Error object or string
   * @param jsErrorName - Optional JavaScript error name
   */
  recordError(error: Error | string, jsErrorName?: string): void {
    try {
      if (error instanceof Error) {
        crashlytics().recordError(error, jsErrorName);
      } else {
        crashlytics().recordError(new Error(error), jsErrorName);
      }
    } catch (err) {
      console.error('Error recording error to Crashlytics:', err);
    }
  }

  /**
   * Force a crash (for testing purposes only)
   * WARNING: This will crash the app!
   * Available in development and testing environments only
   */
  async crash(): Promise<void> {
    // Allow crash testing in development and testing environments
    if (!ENV_CONFIG.enableCrashTest) {
      console.warn('Crash test is only available in development or testing builds');
      return;
    }

    try {
      // Ensure Crashlytics collection is enabled
      await crashlytics().setCrashlyticsCollectionEnabled(true);
      
      const envName = ENV_CONFIG.environmentName.toUpperCase();
      console.warn(`⚠️ Forcing crash for testing (${envName} MODE)...`);
      console.warn('Crashlytics collection enabled, crashing now...');
      
      // Small delay to ensure the setting is applied
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Force the crash
      crashlytics().crash();
    } catch (error) {
      console.error('Error enabling Crashlytics collection or crashing:', error);
      throw error;
    }
  }

  /**
   * Check if Crashlytics is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Enable or disable Crashlytics collection
   * @param enabled - Whether to enable collection
   */
  async setCollectionEnabled(enabled: boolean): Promise<void> {
    try {
      await crashlytics().setCrashlyticsCollectionEnabled(enabled);
    } catch (error) {
      console.error('Error setting Crashlytics collection enabled:', error);
    }
  }

  /**
   * Set multiple attributes at once
   * @param attributes - Object with key-value pairs
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        this.setAttribute(key, value);
      });
    } catch (error) {
      console.error('Error setting Crashlytics attributes:', error);
    }
  }
}

// Export singleton instance
export default new CrashlyticsService();
