import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

class CloudSyncService {
  private user: FirebaseAuthTypes.User | null = null;

  async initialize(): Promise<void> {
    try {
      // Reuse existing anonymous session or create one
      if (auth().currentUser) {
        this.user = auth().currentUser;
      } else {
        const credential = await auth().signInAnonymously();
        this.user = credential.user;
      }
    } catch (error) {
      console.error('CloudSyncService: anonymous auth failed:', error);
      // Non-fatal — app works offline via AsyncStorage
    }
  }

  get uid(): string | null {
    return this.user?.uid ?? null;
  }

  async savePlayerData(playerData: PlayerData): Promise<void> {
    if (!this.user) {
      return;
    }
    try {
      await firestore()
        .collection('players')
        .doc(this.user.uid)
        .set({ ...playerData, updatedAt: firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      console.error('CloudSyncService: failed to save player data:', error);
      // Non-fatal — local save already succeeded
    }
  }

  async loadPlayerData(): Promise<PlayerData | null> {
    if (!this.user) {
      return null;
    }
    try {
      const doc = await firestore()
        .collection('players')
        .doc(this.user.uid)
        .get();
      if (!doc.exists) {
        return null;
      }
      const data = doc.data();
      if (!data) {
        return null;
      }
      // Strip server-side fields before returning as PlayerData
      const { updatedAt: _updatedAt, ...playerData } = data;
      return playerData as PlayerData;
    } catch (error) {
      console.error('CloudSyncService: failed to load player data:', error);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }
}

export default new CloudSyncService();
