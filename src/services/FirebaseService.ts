import firebase from '@react-native-firebase/app';
import { Platform } from 'react-native';

/**
 * Firebase Service
 * Handles Firebase initialization and provides access to Firebase services
 */
class FirebaseService {
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize Firebase
   * This should be called once at app startup
   * Returns a promise that resolves when Firebase is ready
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      console.log('Firebase already initialized');
      return;
    }

    // If initialization is in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create and store the initialization promise
    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Diagnostic logging for iOS Firebase initialization issues
      console.log('🔍 Firebase initialization diagnostic:');
      console.log(`Platform: ${Platform.OS}`);
      console.log(`Firebase module available: ${typeof firebase !== 'undefined'}`);
      
      // Wait a bit for native Firebase to potentially auto-initialize
      // React Native Firebase should auto-configure from GoogleService-Info.plist
      let retries = 10;
      while (!firebase.apps.length && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }
      
      console.log(`Firebase apps length: ${firebase.apps.length}`);
      
      // Check if Firebase apps are available
      // Firebase auto-initializes from native config files
      if (!firebase.apps.length) {
        const diagnosticInfo = Platform.OS === 'ios' 
          ? '\n\niOS Troubleshooting:\n' +
            '1. Ensure GoogleService-Info.plist is in ios/WalkingRPGTemp/ folder\n' +
            '2. Verify it\'s added to Xcode project and "Copy Bundle Resources" phase\n' +
            '3. Clean build: cd ios && rm -rf build && pod install && cd ..\n' +
            '4. Rebuild the app completely (not just reload JS)\n' +
            '5. Check Xcode build logs for Firebase initialization errors'
          : '\n\nAndroid Troubleshooting:\n' +
            '1. Ensure google-services.json is in android/app/ folder\n' +
            '2. Verify Google Services plugin is applied in build.gradle\n' +
            '3. Clean build: cd android && ./gradlew clean && cd ..\n' +
            '4. Rebuild the app completely';
            
        const error = new Error(
          'Firebase apps array is empty - Firebase may not be properly configured. ' +
          'Please ensure google-services.json (Android) and GoogleService-Info.plist (iOS) ' +
          'are properly configured and added to the native projects.' +
          diagnosticInfo
        );
        console.error('Firebase initialization failed:', error.message);
        throw error;
      }

      const app = firebase.app();
      const options = app.options;

      // Verify that we have a valid project ID
      if (!options.projectId) {
        throw new Error('Firebase project ID is missing. Check your configuration files.');
      }

      console.log('Firebase initialized successfully');
      console.log(`Platform: ${Platform.OS}`);
      console.log(`Firebase app name: ${app.name}`);
      console.log(`Firebase project ID: ${options.projectId}`);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      this.initializationPromise = null; // Reset so we can retry
      throw error;
    }
  }

  /**
   * Get the default Firebase app instance
   */
  getApp() {
    if (!this.initialized) {
      throw new Error('Firebase has not been initialized. Call initialize() first.');
    }
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
    if (!this.initialized) {
      throw new Error('Firebase has not been initialized. Call initialize() first.');
    }
    return firebase.app().options;
  }
}

// Export singleton instance
export default new FirebaseService();
