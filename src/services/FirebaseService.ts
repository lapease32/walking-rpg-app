import firebase from '@react-native-firebase/app';
import { Platform } from 'react-native';

/**
 * Firebase Service
 * Handles Firebase initialization and provides access to Firebase services
 */
class FirebaseService {
  private initialized: boolean = false;

  /**
   * Initialize Firebase
   * This should be called once at app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Firebase already initialized');
      return;
    }

    try {
      // Firebase is automatically initialized when the app starts
      // The native modules read from google-services.json (Android) and GoogleService-Info.plist (iOS)
      if (!firebase.apps.length) {
        const error = new Error('Firebase apps array is empty - Firebase may not be properly configured. Please ensure google-services.json (Android) and GoogleService-Info.plist (iOS) are properly configured.');
        console.error('Firebase initialization failed:', error.message);
        throw error;
      }

      console.log('Firebase initialized successfully');
      console.log(`Platform: ${Platform.OS}`);
      console.log(`Firebase app name: ${firebase.app().name}`);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  /**
   * Get the default Firebase app instance
   */
  getApp() {
    return firebase.app();
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get Firebase app options
   */
  getOptions() {
    return firebase.app().options;
  }
}

// Export singleton instance
export default new FirebaseService();
