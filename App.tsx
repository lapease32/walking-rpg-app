import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import FirebaseService from './src/services/FirebaseService';

/**
 * Main App Component
 */
export default function App() {
  useEffect(() => {
    // Initialize Firebase when app starts
    FirebaseService.initialize().catch((error) => {
      console.error('Failed to initialize Firebase:', error);
    });
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <HomeScreen />
    </>
  );
}

