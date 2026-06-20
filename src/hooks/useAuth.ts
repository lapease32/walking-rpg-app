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
      const cloudLoad = await CloudSyncService.loadPlayerData();
      // Only a CONFIRMED 'found' record counts as cloud data. 'empty'/'unavailable' (incl. the
      // timeout/network-error cases) yield null here — and the modal is shown regardless when the
      // anonymous user has data, so the user chooses rather than us auto-uploading local over a
      // (possibly unread) cloud save on a slow network.
      const cloudRecord = cloudLoad.status === 'found' ? cloudLoad.record : null;
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
    // Stop in-flight saves/GPS (account-switch guard) and block NEW cloud writes. Then DRAIN
    // any save already awaiting setDoc so it can't land on players/{uid} after deletion and
    // resurrect the doc (suspendWrites alone only blocks new calls, not in-flight ones).
    // The drain is bounded so a hung offline-queued write can't block deletion forever.
    onAccountSwitchRef.current();
    CloudSyncService.suspendWrites();
    await CloudSyncService.drainPendingWrites();

    // Shared abort path for any failure BEFORE the irreversible auth deletion. Nothing
    // unrecoverable has happened: resume writes, tell the user, and reload the player (local
    // still holds the real character, so no empty archetype screen and no overwrite race).
    const abortDeletion = async (error: any) => {
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
    };

    // Erase cloud data FIRST, while still authenticated — Firestore rules only let a client
    // delete its OWN players/{uid} doc, so this must happen before the auth account is gone.
    // This is the PRIMARY cloud-erasure path: it works without the onUserDeleted Cloud
    // Function deployed (the function is a server-side backstop). If it fails we abort before
    // the irreversible auth deletion, so we never delete the account while orphaning its
    // cloud data — which the confirmation copy promises is gone.
    try {
      await CloudSyncService.deletePlayerData();
    } catch (error: any) {
      await abortDeletion(error);
      return;
    }

    // Delete the auth account (irreversible). If it throws (cancelled re-auth, network), the
    // account and local data are intact, so we abort and reload. The cloud doc was already
    // deleted above; local is still the source of truth, so the next save re-creates the
    // cloud record from local — no data is lost. (Wiping local BEFORE this would, on a
    // cancelled delete, leave an empty local state that paints archetype selection.)
    try {
      await AuthService.deleteAccount();
    } catch (error: any) {
      await abortDeletion(error);
      return;
    }

    // Deletion succeeded (irreversible). Wipe ALL per-user local data so nothing from the
    // deleted account survives into the fresh session. clearAllUserData throws on failure;
    // retry once (a local multiRemove failing twice means storage is unusable anyway). This
    // runs AFTER deletion, so there is no live cloud record for a stale read to race.
    try {
      await clearAllUserData();
    } catch (wipeError) {
      console.error('Local data wipe failed after account deletion; retrying once:', wipeError);
      try {
        await clearAllUserData();
      } catch (retryError) {
        console.error('Local data wipe failed again after account deletion:', retryError);
      }
    }

    // Reset in-memory conflict state, re-establish a fresh anonymous session, and reload as a
    // brand-new player. A failed re-anon here is non-fatal: the account is already gone and
    // the app re-anons on the next launch.
    setConflictState(null);
    conflictResolutionPendingRef.current = false;
    conflictResolvingRef.current = false;
    AnalyticsService.accountDeleted();
    try {
      await AuthService.initialize();
      CloudSyncService.resumeWrites();
      setAuthUser(AuthService.getCurrentUser());
      await onAccountChangeRef.current();
    } catch (error) {
      CloudSyncService.resumeWrites();
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
