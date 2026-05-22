import { AppRegistry, LogBox } from 'react-native';

// Suppress the LogBox overlay in debug builds so non-fatal errors (e.g. Firebase
// auth/keychain-error on unsigned simulator builds) don't cover UI elements and
// break E2E tests. Errors still appear in Metro / Xcode console output.
if (__DEV__) {
  LogBox.ignoreAllLogs();
}
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
// @ts-ignore - app.json is a JSON file imported as module
import { name as appName } from './app.json';

// Register background notification handler
// This must be registered at the app entry point, not in a component
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification?.data?.type === 'encounter') {
    // The encounter will be loaded when the app comes to foreground
    // This handler just ensures the app can respond to notification taps
    console.log('Background notification tapped for encounter');
  }
});

// Required by notifee before any foreground service notification is displayed.
// The runner promise is kept pending — service lifetime is managed explicitly
// via NotificationService.stopForegroundService().
notifee.registerForegroundService(() => new Promise(() => {}));

AppRegistry.registerComponent(appName, () => App);

