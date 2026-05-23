import { AppRegistry, Platform, Settings } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import auth from '@react-native-firebase/auth';
import App from './App';
// @ts-ignore - app.json is a JSON file imported as module
import { name as appName } from './app.json';

// In E2E mode (iOS only), point Firebase Auth at the local emulator so
// anonymous sign-in completes in <100ms without touching real Firebase.
// Firestore is intentionally NOT emulated: the Firestore emulator opens a
// gRPC stream to localhost that dispatches events at near-zero latency,
// keeping the main GCD queue permanently saturated and blocking Detox sync.
// Real Firestore has enough network latency that Detox can see idle windows.
if (Platform.OS === 'ios' && Settings.get('DetoxE2E') === 'YES') {
  auth().useEmulator('http://localhost:9099');
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

