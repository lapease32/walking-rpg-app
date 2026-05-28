import { getApps, getApp } from '@react-native-firebase/app';
import { Platform } from 'react-native';
import CrashlyticsService from './CrashlyticsService';

class FirebaseService {
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    console.warn('[INIT] FirebaseService.initialize start');
    try {
      // Wait for native Firebase to auto-initialize from GoogleService-Info.plist / google-services.json
      let retries = 10;
      while (!getApps().length && retries > 0) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
        retries--;
      }

      if (!getApps().length) {
        const diagnosticInfo =
          Platform.OS === 'ios'
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
            diagnosticInfo,
        );
        console.error('Firebase initialization failed:', error.message);
        throw error;
      }

      const app = getApp();
      const options = app.options;

      if (!options.projectId) {
        throw new Error('Firebase project ID is missing. Check your configuration files.');
      }

      try {
        await CrashlyticsService.initialize();
      } catch (error) {
        console.warn('Crashlytics initialization failed (non-critical):', error);
      }

      this.initialized = true;
      console.warn('[INIT] FirebaseService.initialize end');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  getApp() {
    if (!this.initialized) {
      throw new Error('Firebase has not been initialized. Call initialize() first.');
    }
    return getApp();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getOptions() {
    if (!this.initialized) {
      throw new Error('Firebase has not been initialized. Call initialize() first.');
    }
    return getApp().options;
  }
}

export default new FirebaseService();
