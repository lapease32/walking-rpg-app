import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './src/screens/HomeScreen';
import FirebaseService from './src/services/FirebaseService';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    FirebaseService.initialize().catch((error) => {
      console.error('Failed to initialize Firebase:', error);
    });
  }, []);

  return (
    // GestureHandlerRootView must wrap the whole app for react-native-gesture-handler (and the
    // Reanimated-driven gestures built on it) to work — outermost so every gesture surface is covered.
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <HomeScreen />
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

