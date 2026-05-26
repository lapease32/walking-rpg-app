import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  GoogleAuthProvider,
  AppleAuthProvider,
  FirebaseAuthTypes,
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
  constructor(public readonly credential: FirebaseAuthTypes.AuthCredential) {
    super('auth/credential-already-in-use');
    this.name = 'AccountConflictError';
  }
}

class AuthService {
  async initialize(): Promise<void> {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

    if (!getAuth().currentUser) {
      try {
        await signInAnonymously(getAuth());
      } catch (error) {
        console.error('AuthService: anonymous sign-in failed:', error);
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

  // Signs in directly with a credential that is already linked to an existing account.
  // Only call this after the user has resolved the save conflict via AccountConflictError.
  async signInWithExistingCredential(credential: FirebaseAuthTypes.AuthCredential): Promise<void> {
    await signInWithCredential(getAuth(), credential);
  }

  private async linkOrSignIn(credential: FirebaseAuthTypes.AuthCredential): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (currentUser?.isAnonymous) {
      try {
        // Preserve the anonymous session's data by linking it to the new credential
        await currentUser.linkWithCredential(credential);
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

  private toAuthUser(user: FirebaseAuthTypes.User): AuthUser {
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
