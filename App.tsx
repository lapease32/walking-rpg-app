import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import FirebaseService from './src/services/FirebaseService';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import logger from './src/utils/logger';

/**
 * Everything that needs the palette lives below the ThemeProvider. The app ground and the StatusBar
 * content style both come from the theme (night = light content on near-black; day = dark content
 * on weathered bone).
 */
function ThemedApp() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      <HomeScreen />
    </View>
  );
}

export default function App() {
  useEffect(() => {
    FirebaseService.initialize().catch(error => {
      logger.error('Failed to initialize Firebase', error);
    });
  }, []);

  return (
    // GestureHandlerRootView must wrap the whole app for react-native-gesture-handler (and the
    // Reanimated-driven gestures built on it) to work — outermost so every gesture surface is covered.
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
