import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AuthService, { AuthUser } from '../services/AuthService';
import AnalyticsService from '../services/AnalyticsService';
import { clearLocalPlayerData } from '../utils/storage';

export function useAuth({
  onAccountChange,
  onAccountSwitch,
}: {
  onAccountChange: () => Promise<void>;
  onAccountSwitch: () => void;
}) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const prevUidRef = useRef<string | null>(null);
  const lastNonAnonUidRef = useRef<string | null>(null);

  // Keep callbacks current so the subscription closure never goes stale
  const onAccountChangeRef = useRef(onAccountChange);
  const onAccountSwitchRef = useRef(onAccountSwitch);
  onAccountChangeRef.current = onAccountChange;
  onAccountSwitchRef.current = onAccountSwitch;

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(user => {
      setAuthUser(user);
      const prevUid = prevUidRef.current;
      const newUid = user?.uid ?? null;
      prevUidRef.current = newUid;
      console.log(
        `[useAuth] onAuthStateChanged: prevUid=${prevUid} newUid=${newUid} accountSwitch=${prevUid !== null && newUid !== null && prevUid !== newUid}`,
      );
      if (prevUid !== null && newUid !== null && prevUid !== newUid) {
        // Distinguish a same-account re-sign-in (anonymous → same Google UID after sign-out)
        // from a genuine switch to a different account. Check BEFORE updating lastNonAnonUidRef.
        const isReSignIn = newUid === lastNonAnonUidRef.current;

        // Clear cross-domain state immediately so GPS callbacks bail early during the reload window
        onAccountSwitchRef.current();

        // For a genuine account switch: clear local data so the new account's cloud save always
        // wins the timestamp comparison, preventing cross-account data leakage.
        // For a re-sign-in: skip the clear — the anonymous session's local save is more recent
        // than the pre-sign-out cloud save, so the timestamp comparison preserves that progress.
        const reload = isReSignIn
          ? onAccountChangeRef.current()
          : clearLocalPlayerData().then(() => onAccountChangeRef.current());
        reload.catch(error =>
          console.error('Failed to reload player after account switch:', error),
        );
      }
      // Update after the isReSignIn check so the check sees the previous value
      if (user && !user.isAnonymous) {
        lastNonAnonUidRef.current = user.uid;
      }
    });
    return unsubscribe;
  }, []);

  const initialize = useCallback(async (): Promise<void> => {
    console.log('[useAuth] initialize: start');
    await AuthService.initialize();
    setAuthUser(AuthService.getCurrentUser());
    console.log('[useAuth] initialize: calling onAccountChangeRef.current()');
    await onAccountChangeRef.current();
    console.log('[useAuth] initialize: onAccountChangeRef.current() completed');
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signInWithGoogle();
      AnalyticsService.signIn('google');
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signInWithApple();
      AnalyticsService.signIn('apple');
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signOut();
      AnalyticsService.signOut();
    } catch (error: any) {
      Alert.alert('Sign-out failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  return {
    authUser,
    authLoading,
    initialize,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleSignOut,
  };
}
