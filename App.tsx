import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
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
    <ErrorBoundary>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <HomeScreen />
    </ErrorBoundary>
  );
}

