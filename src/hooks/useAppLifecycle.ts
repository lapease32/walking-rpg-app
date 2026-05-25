import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppLifecycle() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const prevAppStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus): void => {
    appStateRef.current = nextAppState;
    setAppState(nextAppState);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  return { appState, appStateRef, prevAppStateRef };
}
