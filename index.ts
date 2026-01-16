import { AppRegistry, ErrorUtils } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
// @ts-ignore - app.json is a JSON file imported as module
import { name as appName } from './app.json';
import ErrorReportingService from './src/services/ErrorReportingService';

// Initialize error reporting early in app lifecycle
ErrorReportingService.initialize();

// Set up global JavaScript error handler
const originalHandler = ErrorUtils.getGlobalHandler();

ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  // Report to Crashlytics
  ErrorReportingService.recordError(error, 'GlobalJSException');
  
  // Log additional context
  ErrorReportingService.log(`Fatal: ${isFatal}, Error: ${error.message}`);
  
  // Call original handler to maintain default React Native error handling
  if (originalHandler) {
    originalHandler(error, isFatal);
  }
});

// Catch unhandled promise rejections
if (typeof global.Promise !== 'undefined' && global.Promise.reject) {
  const originalReject = Promise.reject;
  Promise.reject = function(reason: any) {
    if (reason instanceof Error) {
      ErrorReportingService.recordNonFatalError(reason, {
        type: 'UnhandledPromiseRejection',
      });
    } else {
      ErrorReportingService.recordError(
        new Error(String(reason)),
        'UnhandledPromiseRejection'
      );
    }
    return originalReject.call(this, reason);
  };
}

// Register background notification handler
// This must be registered at the app entry point, not in a component
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.PRESS && detail.notification?.data?.type === 'encounter') {
      // The encounter will be loaded when the app comes to foreground
      // This handler just ensures the app can respond to notification taps
      ErrorReportingService.log('Background notification tapped for encounter');
    }
  } catch (error) {
    ErrorReportingService.recordNonFatalError(error as Error, {
      context: 'BackgroundNotificationHandler',
    });
  }
});

AppRegistry.registerComponent(appName, () => App);

