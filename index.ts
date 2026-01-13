import { AppRegistry } from 'react-native';
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

AppRegistry.registerComponent(appName, () => App);

