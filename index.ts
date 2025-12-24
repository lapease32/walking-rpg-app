import { AppRegistry } from 'react-native';
import App from './App';
// @ts-ignore - app.json is a JSON file imported as module
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

