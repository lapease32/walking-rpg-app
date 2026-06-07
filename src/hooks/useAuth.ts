import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AuthService, { AccountConflictError, AuthUser } from '../services/AuthService';
import CloudSyncService from '../services/CloudSyncService';
import AnalyticsService from '../services/AnalyticsService';
import {
  clearAllUserData,
  clearLocalPlayerData,
  clearPendingConflict,
  readLocalPlayerSnapshot,
  readPendingConflict,
  writeLocalPlayerSnapshot,
  writePendingConflict,
} from '../utils/storage';
import { PlayerData } from '../models/Player';

export interface ConflictState {
  localData: PlayerData | null;
  localSavedAt: number;
  cloudData: PlayerData | null;
  cloudSavedAt: number;
}

export function useAuth({
  onAccountChange,
  onAccountSwitch,
}: {
  onAccountChange: () => Promise<void>;
  onAccountSwitch: () => void;
}) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const prevUidRef = useRef<string | null>(null);
  const lastNonAnonUidRef = useRef<string | null>(null);
  // When true, the onAuthStateChanged handler skips the normal clear+load flow.
  // Set before signInWithExistingCredential so the auth-state change it triggers
  // doesn't wipe local data before we've had a chance to compare saves.
  const conflictResolutionPendingRef = useRef(false);
  // Re-entry guard: setConflictState(null) doesn't flush synchronously, so a
  // rapid double-tap could pass the conflictState !== null check twice.
  const conflictResolvingRef = useRef(false);
  // One-shot: armed only when initialize loads with NO current user (i.e.
  // AuthService.signInAnonymously hit its 10s timeout). A belated sign-in
  // afterward then triggers exactly one reload so cloud progress isn't
  // skipped. Scoped this narrowly — NOT a generic "init done" flag — so the
  // re-anonymous sign-in that signOut() performs internally doesn't match and
  // spuriously reload. Reset to false as soon as it fires.
  const pendingBelatedSignInRef = useRef(false);

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
      if (prevUid !== null && newUid !== null && prevUid !== newUid) {
        // Conflict resolution in progress — the sign-in was triggered by our own
        // handleAccountConflict flow. Skip clear+load; that flow handles it explicitly.
        if (conflictResolutionPendingRef.current) {
          if (user && !user.isAnonymous) {
            lastNonAnonUidRef.current = user.uid;
          }
          return;
        }

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
      } else if (
        pendingBelatedSignInRef.current &&
        prevUid === null &&
        newUid !== null &&
        !conflictResolutionPendingRef.current
      ) {
        // Belated first sign-in: AuthService.signInAnonymously timed out during
        // initialize, so onAccountChange ran with currentUser=null and the user
        // is missing any cloud progress. Trigger a reload now that the user is
        // actually signed in. No clear — anon save was created on null user and
        // the timestamp comparison in loadPlayerData picks the right one.
        // One-shot: disarm immediately so later null→non-null transitions
        // (e.g. the re-anon sign-in after a sign-out) don't reload spuriously.
        pendingBelatedSignInRef.current = false;
        onAccountChangeRef
          .current()
          .catch(error =>
            console.error('Failed to reload player after late initial sign-in:', error),
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
    await AuthService.initialize();
    const user = AuthService.getCurrentUser();
    setAuthUser(user);

    // Re-show the conflict modal if the app was killed while it was open.
    // We're already signed into the linked account from the previous session.
    const pending = await readPendingConflict();
    if (pending && user && !user.isAnonymous) {
      conflictResolutionPendingRef.current = true;
      onAccountSwitchRef.current();
      setConflictState(pending);
      return;
    }
    if (pending) {
      // User is no longer authenticated as the linked account — clear stale state.
      await clearPendingConflict();
    }
    // Arm the belated-sign-in reload ONLY when we're about to load with no
    // user — i.e. signInAnonymously timed out in AuthService.initialize. Set
    // BEFORE awaiting onAccountChange: the await can run for hundreds of ms
    // (Firestore fetch) and the belated signInAnonymously response could
    // arrive during that window; the listener then fires a fresh reload. If a
    // user is already present (normal case), leave it disarmed so the re-anon
    // sign-in after a future sign-out doesn't reload spuriously. The fresh
    // reload may race the in-flight one; usePlayer's generation guard makes
    // the most-recently-started call win.
    pendingBelatedSignInRef.current = AuthService.getCurrentUser() === null;
    await onAccountChangeRef.current();
  }, []);

  const handleAccountConflict = async (error: AccountConflictError): Promise<void> => {
    // Capture the anonymous save BEFORE the auth state changes
    const localSnapshot = await readLocalPlayerSnapshot();

    // Auto-resolve only when the anonymous user has no save — no choice needed
    if (!localSnapshot.data) {
      await clearLocalPlayerData();
      await AuthService.signInWithExistingCredential(error.credential);
      return;
    }

    // Block onAuthStateChanged from running the normal clear+load during sign-in.
    // Kept true until resolveConflict completes — a late auth-state callback must
    // not run clearLocalPlayerData() while the user is still choosing a save.
    conflictResolutionPendingRef.current = true;
    let conflictStateWasSet = false;
    try {
      await AuthService.signInWithExistingCredential(error.credential);
      // Stop in-memory player from fire-and-forgetting saves to the new account
      // UID while the conflict modal is displayed.
      onAccountSwitchRef.current();
      const cloudRecord = await CloudSyncService.loadPlayerData();

      // Always show the modal when the anonymous user has data. Treating a null
      // cloud record as "no save" is unsafe — loadPlayerData returns null on
      // timeout and network errors too, so auto-uploading in that case would
      // silently overwrite an existing cloud save on a slow network.
      const pendingRecord = {
        localData: localSnapshot.data,
        localSavedAt: localSnapshot.savedAt,
        cloudData: cloudRecord?.playerData ?? null,
        cloudSavedAt: cloudRecord?.lastSavedAt ?? 0,
      };
      // Persist before showing modal: if the app is killed the moment the modal
      // appears, readPendingConflict on restart must find the record. Persisting
      // first also eliminates a race where resolveConflict → clearPendingConflict
      // could run before writePendingConflict completes (impossible in practice, but
      // the ordering makes it structurally impossible).
      await writePendingConflict(pendingRecord);
      setConflictState(pendingRecord);
      conflictStateWasSet = true;
    } finally {
      // Only clear the guard if we failed to show the modal. If the modal is
      // showing, the guard must stay true until resolveConflict() clears it.
      if (!conflictStateWasSet) {
        conflictResolutionPendingRef.current = false;
      }
    }
  };

  const resolveConflict = async (choice: 'local' | 'cloud'): Promise<void> => {
    if (!conflictState || conflictResolvingRef.current) return;
    conflictResolvingRef.current = true;

    // Capture before setConflictState(null) so both branches can reference them.
    const { localData, localSavedAt, cloudData, cloudSavedAt } = conflictState;
    setConflictState(null);
    // onAccountSwitchRef was already called in handleAccountConflict to stop
    // in-flight saves — don't call it again here or it double-clears state.

    try {
      if (choice === 'local') {
        // Re-read AsyncStorage rather than using conflictState.localData, which was
        // captured at sign-in time and may be stale if background tracking continued.
        // Fall back to the captured snapshot if AsyncStorage returns null (e.g., corruption).
        const freshSnapshot = await readLocalPlayerSnapshot();
        const dataToSave = freshSnapshot.data ?? localData;
        if (dataToSave) {
          const baseTimestamp = freshSnapshot.data ? freshSnapshot.savedAt : localSavedAt;
          const freshTimestamp = Math.max(baseTimestamp, Date.now());
          // Fire-and-forget cloud upload; swallows errors internally.
          CloudSyncService.savePlayerData(dataToSave, freshTimestamp);
          // Write the fresh timestamp to local storage so loadPlayerData's
          // comparison always picks local — even if the cloud upload fails or
          // is still in-flight. This is the source of truth for the reload.
          try {
            await writeLocalPlayerSnapshot(dataToSave, freshTimestamp);
          } catch {
            // Storage failure: local snapshot not written, so loadPlayerData may
            // prefer the cloud record instead of the guest save the user chose.
            Alert.alert(
              'Storage error',
              'Could not write your save locally. Your progress may not be restored correctly.',
            );
          }
        }
      } else {
        // Write the already-fetched cloud record to local storage as a fallback.
        // loadPlayerData still prefers Firestore if the live re-fetch returns
        // a strictly newer record, but if that fetch fails or times out, the
        // local copy ensures the user keeps the cloud save they chose rather
        // than being reset to a new player.
        if (cloudData) {
          // Non-fatal: loadPlayerData re-fetches from Firestore regardless.
          await writeLocalPlayerSnapshot(cloudData, cloudSavedAt).catch(e =>
            console.error('resolveConflict: writeLocalPlayerSnapshot failed for cloud choice:', e),
          );
        } else {
          await clearLocalPlayerData();
        }
      }
      await onAccountChangeRef.current();
    } finally {
      // Always clear persisted conflict state and release both guards — even if
      // onAccountChange throws, stale callbacks must not permanently block the
      // normal account-switch flow.
      await clearPendingConflict();
      conflictResolutionPendingRef.current = false;
      conflictResolvingRef.current = false;
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await AuthService.signInWithGoogle();
      AnalyticsService.signIn('google');
    } catch (error: any) {
      if (error instanceof AccountConflictError) {
        try {
          await handleAccountConflict(error);
        } catch (conflictError: any) {
          Alert.alert(
            'Sign-in failed',
            conflictError?.message ?? 'Something went wrong. Please try again.',
          );
        }
      } else {
        Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
      }
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
      if (error instanceof AccountConflictError) {
        try {
          await handleAccountConflict(error);
        } catch (conflictError: any) {
          Alert.alert(
            'Sign-in failed',
            conflictError?.message ?? 'Something went wrong. Please try again.',
          );
        }
      } else {
        Alert.alert('Sign-in failed', error?.message ?? 'Something went wrong. Please try again.');
      }
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

  const handleDeleteAccount = async () => {
    setAuthLoading(true);
    // Phase 1 — delete the account. Stop in-flight saves/GPS first (account-switch guard).
    // If deletion throws (no user, re-auth cancelled, network), the account AND local data
    // are still intact: reload the player so the user returns to their game instead of a
    // stranded "Loading…" screen, and wipe nothing.
    try {
      onAccountSwitchRef.current();
      // Block cloud writes so an in-flight or late fire-and-forget save can't recreate
      // players/{uid} after deletion (which would defeat erasure).
      CloudSyncService.suspendWrites();
      await AuthService.deleteAccount();
    } catch (error: any) {
      // Deletion aborted — the account is intact, so resume saves.
      CloudSyncService.resumeWrites();
      Alert.alert(
        'Couldn’t delete account',
        error?.message ?? 'Something went wrong. Please try again.',
      );
      try {
        setAuthUser(AuthService.getCurrentUser());
        await onAccountChangeRef.current();
      } catch (reloadError) {
        console.error('Failed to reload player after aborted account deletion:', reloadError);
      } finally {
        setAuthLoading(false);
      }
      return;
    }
    // Phase 2 — deletion succeeded (irreversible). Wipe local, record, re-establish a fresh
    // anonymous session, and reload as a brand-new player. A failed re-auth here is
    // non-fatal: the account is already gone and the app re-anons on the next launch.
    try {
      // Wipe ALL per-user local data (player, pending encounter, tracking, conflict) so
      // nothing from the deleted account survives into the fresh session.
      await clearAllUserData();
      // Also reset the in-memory/ref conflict state so a stale conflict can't reopen a
      // modal or skip the reload path on the re-anon sign-in.
      setConflictState(null);
      conflictResolutionPendingRef.current = false;
      conflictResolvingRef.current = false;
      AnalyticsService.accountDeleted();
      await AuthService.initialize();
      // Fresh anonymous session established — the new account may write again.
      CloudSyncService.resumeWrites();
      setAuthUser(AuthService.getCurrentUser());
      await onAccountChangeRef.current();
    } catch (error) {
      // Ensure writes aren't left suspended if the reset failed.
      CloudSyncService.resumeWrites();
      // Deletion already succeeded; the reset (re-anon/reload) failed. Tell the user to
      // restart rather than leaving them on a silent half-reset state — a fresh launch
      // re-anons cleanly.
      console.error(
        'Post-deletion reset failed (account is deleted; recovers on relaunch):',
        error,
      );
      Alert.alert(
        'Account deleted',
        'Your account and data were deleted. Please restart the app to continue.',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  return {
    authUser,
    authLoading,
    conflictState,
    resolveConflict,
    initialize,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleSignOut,
    handleDeleteAccount,
  };
}
