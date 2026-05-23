import { AppRegistry, Platform, Settings } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import App from './App';
// @ts-ignore - app.json is a JSON file imported as module
import { name as appName } from './app.json';

// In E2E mode (iOS only), point Firebase at local emulators so auth is instant
// and no real Firebase project is touched during CI runs.
if (Platform.OS === 'ios' && Settings.get('DetoxE2E') === 'YES') {
  auth().useEmulator('http://localhost:9099');
  firestore().useEmulator('localhost', 8080);
}

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

