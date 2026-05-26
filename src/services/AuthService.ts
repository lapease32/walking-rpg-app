import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  connectAuthEmulator,
  GoogleAuthProvider,
  AppleAuthProvider,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { getEmulatorHost } from '../native/FirebaseEmulator';

const GOOGLE_WEB_CLIENT_ID =
  '127260614524-4kb18foii77g0rtjjl446r5v3nvj3usc.apps.googleusercontent.com';

// Begin the emulator host lookup at module-import time so the native call
// is in-flight as early as possible. initialize() awaits this before making
// any Firebase network calls, ensuring auth and Firestore are routed to the
// emulator before signInAnonymously() fires.
// Returns null on iOS, real devices, and non-CI Android emulators.
const _emulatorsReady: Promise<void> = getEmulatorHost().then(host => {
  if (host) {
    connectAuthEmulator(getAuth(), `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(), host, 8080);
  }
});

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  photoURL: string | null;
}

class AuthService {
  async initialize(): Promise<void> {
    await _emulatorsReady;
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
        // The account already has a Firebase record — sign in to it instead.
        // The anonymous session's data is abandoned in favour of the existing account's cloud save.
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
