import { AppRegistry, LogBox, Platform, Settings } from 'react-native';

// Firebase anonymous sign-in fails with auth/keychain-error on unsigned
// simulator builds (CODE_SIGNING_ALLOWED=NO removes keychain entitlements).
// Non-fatal — the app continues with local storage — but the console.error
// would open a LogBox overlay in local development. Suppress the specific
// message to keep other warnings visible.
if (__DEV__) {
  LogBox.ignoreLogs(['AuthService: anonymous sign-in failed']);
}

// When running Detox E2E tests the LogBox warning bar covers the bottom of the
// scroll view, causing scroll interactions to fail Detox's 100% visibility
// threshold. Suppress all LogBox overlays for the test session only.
//
// Detection: .detoxrc.js passes launchArgs: { DetoxE2E: 'YES' }. iOS
// registers launch arguments in NSUserDefaults (NSArgumentDomain), which
// React Native's Settings module reads. This has no effect outside Detox runs.
if (Platform.OS === 'ios' && Settings.get('DetoxE2E') === 'YES') {
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

