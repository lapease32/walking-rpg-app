import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Obtain this from Firebase Console after enabling Google Sign-In:
// Authentication → Sign-in method → Google → Web SDK configuration → Web client ID
// Then replace this value and re-download GoogleService-Info.plist / google-services.json.
const GOOGLE_WEB_CLIENT_ID = '';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  photoURL: string | null;
}

class AuthService {
  async initialize(): Promise<void> {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

    if (!auth().currentUser) {
      try {
        await auth().signInAnonymously();
      } catch (error) {
        console.error('AuthService: anonymous sign-in failed:', error);
      }
    }
  }

  getCurrentUser(): AuthUser | null {
    const user = auth().currentUser;
    return user ? this.toAuthUser(user) : null;
  }

  isAnonymous(): boolean {
    return auth().currentUser?.isAnonymous ?? true;
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return auth().onAuthStateChanged(user => {
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
    const credential = auth.GoogleAuthProvider.credential(idToken);
    await this.linkOrSignIn(credential);
  }

  async signInWithApple(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    // Dynamic require keeps Android bundle free of iOS-only native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appleAuth = require('@invertase/react-native-apple-authentication').default;
    const appleResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    const { identityToken, nonce } = appleResponse;
    if (!identityToken) {
      throw new Error('Apple Sign-In failed: no identity token returned');
    }
    const credential = auth.AppleAuthProvider.credential(identityToken, nonce);
    await this.linkOrSignIn(credential);
  }

  async signOut(): Promise<void> {
    const user = auth().currentUser;
    if (user && !user.isAnonymous) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Not signed in via Google — silently ignore
      }
    }
    await auth().signOut();
    // Re-authenticate anonymously so cloud sync continues to work after sign-out
    await auth().signInAnonymously();
  }

  private async linkOrSignIn(credential: FirebaseAuthTypes.AuthCredential): Promise<void> {
    const currentUser = auth().currentUser;
    if (currentUser?.isAnonymous) {
      try {
        // Preserve the anonymous session's data by linking it to the new credential
        await currentUser.linkWithCredential(credential);
        return;
      } catch (error: any) {
        const accountAlreadyExists =
          error.code === 'auth/credential-already-in-use' ||
          error.code === 'auth/email-already-in-use';
        if (!accountAlreadyExists) throw error;
        // The account already has a Firebase record — sign in to it instead.
        // The anonymous session's data is abandoned in favour of the existing account's cloud save.
      }
    }
    await auth().signInWithCredential(credential);
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
