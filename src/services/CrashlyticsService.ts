import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
  log,
  recordError,
  setAttribute,
  setUserId,
  crash,
} from '@react-native-firebase/crashlytics';
import { ENV_CONFIG } from '../constants/environment';

class CrashlyticsService {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (__DEV__) {
        await setCrashlyticsCollectionEnabled(getCrashlytics(), true);
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Crashlytics:', error);
      throw error;
    }
  }

  log(message: string): void {
    try {
      log(getCrashlytics(), message);
    } catch (error) {
      console.error('Error logging to Crashlytics:', error);
    }
  }

  setAttribute(key: string, value: string | number | boolean): void {
    try {
      setAttribute(getCrashlytics(), key, String(value));
    } catch (error) {
      console.error('Error setting Crashlytics attribute:', error);
    }
  }

  setUserId(userId: string): void {
    try {
      setUserId(getCrashlytics(), userId);
    } catch (error) {
      console.error('Error setting Crashlytics user ID:', error);
    }
  }

  recordError(error: Error | string, jsErrorName?: string): void {
    try {
      if (error instanceof Error) {
        recordError(getCrashlytics(), error, jsErrorName);
      } else {
        recordError(getCrashlytics(), new Error(error), jsErrorName);
      }
    } catch (err) {
      console.error('Error recording error to Crashlytics:', err);
    }
  }

  async crash(): Promise<void> {
    // Allow crash testing in development and testing environments
    if (!ENV_CONFIG.enableCrashTest) {
      console.warn('Crash test is only available in development or testing builds');
      return;
    }

    try {
      await setCrashlyticsCollectionEnabled(getCrashlytics(), true);

      const envName = ENV_CONFIG.environmentName.toUpperCase();
      console.warn(`⚠️ Forcing crash for testing (${envName} MODE)...`);
      console.warn('Crashlytics collection enabled, crashing now...');

      await new Promise<void>(resolve => setTimeout(() => resolve(), 200));

      crash(getCrashlytics());
    } catch (error) {
      console.error('Error enabling Crashlytics collection or crashing:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async setCollectionEnabled(enabled: boolean): Promise<void> {
    try {
      await setCrashlyticsCollectionEnabled(getCrashlytics(), enabled);
    } catch (error) {
      console.error('Error setting Crashlytics collection enabled:', error);
    }
  }

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

export default new CrashlyticsService();
