import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

export interface CloudPlayerRecord {
  playerData: PlayerData;
  lastSavedAt: number;
}

class CloudSyncService {
  private user: FirebaseAuthTypes.User | null = null;

  async initialize(): Promise<void> {
    try {
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

  async savePlayerData(playerData: PlayerData, lastSavedAt: number): Promise<void> {
    if (!this.user) {
      return;
    }
    const docRef = firestore().collection('players').doc(this.user.uid);
    try {
      await firestore().runTransaction(async transaction => {
        const doc = await transaction.get(docRef);
        const existing = doc.data() as { lastSavedAt?: number } | undefined;
        // Only write if this save is strictly newer than what's in Firestore,
        // preventing out-of-order fire-and-forget writes from overwriting newer data
        if (!existing || (existing.lastSavedAt ?? 0) < lastSavedAt) {
          transaction.set(docRef, { playerData, lastSavedAt });
        }
      });
    } catch (error) {
      console.error('CloudSyncService: failed to save player data:', error);
      // Non-fatal — local save already succeeded
    }
  }

  async loadPlayerData(): Promise<CloudPlayerRecord | null> {
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
      const data = doc.data() as { playerData: PlayerData; lastSavedAt: number } | undefined;
      if (!data?.playerData) {
        return null;
      }
      return { playerData: data.playerData, lastSavedAt: data.lastSavedAt };
    } catch (error) {
      console.error('CloudSyncService: failed to load player data:', error);
      return null;
    }
  }
}

export default new CloudSyncService();
