/**
 * Error Reporting Service using Firebase Crashlytics
 * 
 * Provides centralized error reporting functionality for the app.
 * Automatically captures crashes and allows manual error reporting.
 */

import crashlytics from '@react-native-firebase/crashlytics';

class ErrorReportingService {
  private isEnabled: boolean = true;

  /**
   * Initialize error reporting
   * Should be called early in app lifecycle
   */
  initialize(): void {
    try {
      // Enable crashlytics collection (disable in development if needed)
      crashlytics().setCrashlyticsCollectionEnabled(!__DEV__ || this.isEnabled);
      
      // Set app version for better crash tracking
      // This will be set from package.json version if available
      
      if (__DEV__) {
        crashlytics().log('Error reporting initialized in development mode');
      }
    } catch (error) {
      // Fail silently if Crashlytics isn't configured yet
      console.warn('Failed to initialize Crashlytics:', error);
    }
  }

  /**
   * Record a JavaScript error
   * @param error - The error object to record
   * @param jsErrorName - Optional name for the error
   */
  recordError(error: Error, jsErrorName?: string): void {
    try {
      crashlytics().recordError(error, jsErrorName);
      console.error('Error reported to Crashlytics:', jsErrorName || error.name, error);
    } catch (reportingError) {
      // If Crashlytics fails, at least log to console
      console.error('Failed to report error to Crashlytics:', reportingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Log a message (appears in crash reports)
   * Useful for breadcrumbs and debugging
   * @param message - Message to log
   */
  log(message: string): void {
    try {
      crashlytics().log(message);
      if (__DEV__) {
        console.log('[Crashlytics]', message);
      }
    } catch (error) {
      console.warn('Failed to log to Crashlytics:', error);
    }
  }

  /**
   * Set user identifier for crash reports
   * @param userId - Unique user identifier
   */
  setUserId(userId: string): void {
    try {
      crashlytics().setUserId(userId);
      this.log(`User ID set: ${userId}`);
    } catch (error) {
      console.warn('Failed to set Crashlytics user ID:', error);
    }
  }

  /**
   * Set a custom attribute on crash reports
   * @param key - Attribute key
   * @param value - Attribute value
   */
  setAttribute(key: string, value: string): void {
    try {
      crashlytics().setAttribute(key, value);
      if (__DEV__) {
        console.log(`[Crashlytics] Attribute set: ${key} = ${value}`);
      }
    } catch (error) {
      console.warn(`Failed to set Crashlytics attribute ${key}:`, error);
    }
  }

  /**
   * Set multiple attributes at once
   * @param attributes - Object with key-value pairs
   */
  setAttributes(attributes: Record<string, string>): void {
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        this.setAttribute(key, value);
      });
    } catch (error) {
      console.warn('Failed to set Crashlytics attributes:', error);
    }
  }

  /**
   * Enable or disable error reporting
   * @param enabled - Whether to enable error reporting
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      crashlytics().setCrashlyticsCollectionEnabled(enabled);
      this.log(`Crashlytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.warn('Failed to set Crashlytics enabled state:', error);
    }
  }

  /**
   * Force a test crash (for testing Crashlytics integration)
   * WARNING: This will crash the app!
   * Only use for testing in development builds.
   */
  async testCrash(): Promise<void> {
    if (!__DEV__) {
      console.warn('testCrash() should only be called in development');
      return;
    }
    
    try {
      this.log('Test crash triggered');
      await crashlytics().crash();
    } catch (error) {
      console.error('Failed to trigger test crash:', error);
    }
  }

  /**
   * Record a non-fatal exception
   * Use this for caught errors that you want to track but don't want to crash the app
   * @param error - The error object
   * @param context - Additional context about where/why the error occurred
   */
  recordNonFatalError(error: Error, context?: Record<string, string>): void {
    try {
      if (context) {
        this.setAttributes(context);
      }
      this.recordError(error, 'NonFatalError');
      
      // Clear context after recording to avoid polluting future reports
      if (context) {
        // Note: Crashlytics doesn't have a direct "clear attributes" method
        // Attributes persist until the next crash/report
      }
    } catch (reportingError) {
      console.error('Failed to record non-fatal error:', reportingError);
    }
  }
}

export default new ErrorReportingService();
