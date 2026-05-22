import { AppRegistry, LogBox } from 'react-native';

// Firebase anonymous sign-in fails with auth/keychain-error on unsigned
// simulator builds (CODE_SIGNING_ALLOWED=NO removes keychain entitlements).
// This is non-fatal — the app continues with local storage only — but the
// resulting console.error would open a LogBox overlay that covers UI elements
// and breaks E2E tests. Ignoring this specific message keeps all other
// warnings visible in local development.
if (__DEV__) {
  LogBox.ignoreLogs(['AuthService: anonymous sign-in failed']);
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

