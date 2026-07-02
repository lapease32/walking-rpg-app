import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  reauthenticateWithCredential,
  linkWithCredential,
  GoogleAuthProvider,
  AppleAuthProvider,
  type User,
  type AuthCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

const GOOGLE_WEB_CLIENT_ID =
  '127260614524-4kb18foii77g0rtjjl446r5v3nvj3usc.apps.googleusercontent.com';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  photoURL: string | null;
}

// Thrown by linkOrSignIn when the credential belongs to an existing account.
// The caller is responsible for showing resolution UI and calling
// AuthService.signInWithExistingCredential() once the user has chosen a save.
export class AccountConflictError extends Error {
  constructor(public readonly credential: AuthCredential) {
    super('auth/credential-already-in-use');
    this.name = 'AccountConflictError';
  }
}

class AuthService {
  async initialize(): Promise<void> {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

    const existingUser = getAuth().currentUser;
    if (!existingUser) {
      // 10s timeout matches the Java prewarm budget. If signInAnonymously hangs
      // (observed under New Architecture against the Firebase Auth emulator),
      // fail loudly instead of blocking the app's loading screen forever.
      // clearTimeout is required so the happy path doesn't leak an unhandled
      // rejection when the timer fires after sign-in already succeeded.
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('signInAnonymously timed out after 10s')),
          10000,
        );
      });
      const signInPromise = signInAnonymously(getAuth());
      // Attach a separate handler so that if signInAnonymously rejects AFTER
      // the timeout already settled the race, the rejection isn't surfaced as
      // an unhandled promise rejection. Promise.race's internal handlers
      // observe the rejection too, but this is explicit insurance — late
      // rejections (e.g. network-layer timeouts at 30s) are a known shape.
      signInPromise.catch(() => {});
      try {
        await Promise.race([signInPromise, timeoutPromise]);
      } catch (error) {
        console.error('AuthService: anonymous sign-in failed:', error);
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    }
  }

  getCurrentUser(): AuthUser | null {
    const user = getAuth().currentUser;
    return user ? this.toAuthUser(user) : null;
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(getAuth(), user => {
      callback(user ? this.toAuthUser(user) : null);
    });
  }

  async signInWithGoogle(): Promise<void> {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      return; // User cancelled
    }
    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) {
      throw new Error('Google Sign-In failed: no ID token returned');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    await this.linkOrSignIn(credential);
  }

  async signInWithApple(): Promise<void> {
    if (Platform.OS !== 'ios') {
      return;
    }
    // Dynamic require keeps Android bundle free of iOS-only native module
    const appleAuth = require('@invertase/react-native-apple-authentication').default;
    const appleResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    const { identityToken, nonce } = appleResponse;
    if (!identityToken) {
      throw new Error('Apple Sign-In failed: no identity token returned');
    }
    const credential = AppleAuthProvider.credential(identityToken, nonce);
    await this.linkOrSignIn(credential);
  }

  async signOut(): Promise<void> {
    const user = getAuth().currentUser;
    if (user && !user.isAnonymous) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Not signed in via Google — silently ignore
      }
    }
    await signOut(getAuth());
    try {
      // Re-authenticate anonymously so cloud sync continues to work after sign-out.
      // Non-fatal if this fails — sign-out succeeded; cloud sync resumes on next app launch.
      await signInAnonymously(getAuth());
    } catch (error) {
      console.error('AuthService: anonymous re-auth failed after sign-out:', error);
    }
  }

  /**
   * Permanently delete the current user's Firebase Auth account (GDPR / Apple 5.1.1(v)).
   * The caller (useAuth.handleDeleteAccount) erases the user's Firestore data FIRST, via
   * CloudSyncService.deletePlayerData while still authenticated — that is the primary cloud
   * cleanup and works without any Cloud Function deployed. The server-side `onUserDeleted`
   * trigger is a backstop for the case the client can't finish. Firebase requires a recent
   * login for deletion; if a non-anonymous session is stale, re-auth with the provider and
   * retry once. Anonymous users delete directly. Re-establishing a fresh anonymous session
   * afterward is the caller's responsibility (kept separate — see below).
   */
  async deleteAccount(): Promise<void> {
    let user = getAuth().currentUser;
    if (!user) {
      // No account to delete — throw so the caller doesn't wipe local data as if a
      // deletion succeeded.
      throw new Error('No account is signed in to delete.');
    }
    const wasAnonymous = user.isAnonymous;
    if (!wasAnonymous) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Not signed in via Google — ignore.
      }
    }
    try {
      await user.delete();
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login' && !wasAnonymous) {
        await this.reauthenticate();
        user = getAuth().currentUser;
        if (!user) {
          throw new Error('Re-authentication did not restore a user to delete.');
        }
        await user.delete();
      } else {
        throw error;
      }
    }
    // Re-establishing an anonymous session is the CALLER's responsibility
    // (useAuth.handleDeleteAccount) — kept separate so a failed re-auth/sign-in isn't
    // mistaken for a failed deletion (the deletion above already succeeded).
  }

  // Refresh the current non-anonymous user's credentials via their sign-in provider —
  // required by Firebase before sensitive operations (account deletion) when the
  // session is stale (auth/requires-recent-login).
  private async reauthenticate(): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error('No user to re-authenticate');
    }
    const providerId = user.providerData[0]?.providerId;
    if (providerId === 'google.com') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        throw new Error('Re-authentication cancelled');
      }
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) {
        throw new Error('Re-authentication failed: no ID token returned');
      }
      await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
    } else if (providerId === 'apple.com') {
      if (Platform.OS !== 'ios') {
        throw new Error('Apple re-authentication is only available on iOS');
      }
      const appleAuth = require('@invertase/react-native-apple-authentication').default;
      const appleResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      const { identityToken, nonce } = appleResponse;
      if (!identityToken) {
        throw new Error('Re-authentication failed: no identity token returned');
      }
      await reauthenticateWithCredential(user, AppleAuthProvider.credential(identityToken, nonce));
    } else {
      throw new Error(`Cannot re-authenticate unsupported provider: ${providerId ?? 'unknown'}`);
    }
  }

  // Signs in directly with a credential that is already linked to an existing account.
  // Only call this after the user has resolved the save conflict via AccountConflictError.
  async signInWithExistingCredential(credential: AuthCredential): Promise<void> {
    await signInWithCredential(getAuth(), credential);
  }

  private async linkOrSignIn(credential: AuthCredential): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (currentUser?.isAnonymous) {
      try {
        // Preserve the anonymous session's data by linking it to the new credential
        await linkWithCredential(currentUser, credential);
        return;
      } catch (error: any) {
        const accountAlreadyExists =
          error.code === 'auth/credential-already-in-use' ||
          error.code === 'auth/email-already-in-use';
        if (!accountAlreadyExists) {
          throw error;
        }
        // The credential belongs to an existing account — surface this to the caller
        // so they can show resolution UI before any data is lost.
        throw new AccountConflictError(credential);
      }
    }
    await signInWithCredential(getAuth(), credential);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      isAnonymous: user.isAnonymous,
      photoURL: user.photoURL,
    };
  }
}

export default new AuthService();
