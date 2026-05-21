import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

export interface CloudPlayerRecord {
  playerData: PlayerData;
  lastSavedAt: number;
}

class CloudSyncService {
  async savePlayerData(playerData: PlayerData, lastSavedAt: number): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      return;
    }
    try {
      const docRef = firestore().collection('players').doc(user.uid);
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
    const user = auth().currentUser;
    if (!user) {
      return null;
    }
    try {
      // Race against a 10s deadline so a slow Firestore connection on cold CI
      // or a bad network never blocks the loading screen indefinitely.
      const doc = await Promise.race([
        firestore().collection('players').doc(user.uid).get(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('firestore/load-timeout')), 10000),
        ),
      ]);
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
