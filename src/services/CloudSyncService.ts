import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

export interface CloudPlayerRecord {
  playerData: PlayerData;
  lastSavedAt: number;
}

class CloudSyncService {
  // When loadPlayerData() times out, the original Firestore request is still in
  // flight. We keep a reference here so storage.ts can pick it up and persist the
  // result to local storage if cloud turns out to be newer — preventing a slow
  // first Firestore fetch from permanently discarding a valid cloud save.
  private _pendingLoad: Promise<CloudPlayerRecord | null> | null = null;

  consumePendingLoad(): Promise<CloudPlayerRecord | null> | null {
    const p = this._pendingLoad;
    this._pendingLoad = null;
    return p;
  }
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
    // Start the request before the race so we can reuse it as the background
    // load if the timeout fires first.
    const firestoreGet = firestore().collection('players').doc(user.uid).get();
    let timedOut = false;
    let firestoreTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Race against a 10s deadline so a slow Firestore connection on cold CI
      // or a bad network never blocks the loading screen indefinitely.
      // clearTimeout in finally prevents the losing timer from emitting an
      // unhandled rejection after the race has already settled.
      const doc = await Promise.race([
        firestoreGet,
        new Promise<never>((_, reject) => {
          firestoreTimeout = setTimeout(() => {
            timedOut = true;
            reject(new Error('firestore/load-timeout'));
          }, 10000);
        }),
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
      if (timedOut) {
        // The original request is still in flight. Expose it so storage.ts can
        // reconcile and persist the result if it arrives and is newer than local.
        this._pendingLoad = firestoreGet
          .then(doc => {
            if (!doc.exists) return null;
            const data = doc.data() as { playerData: PlayerData; lastSavedAt: number } | undefined;
            if (!data?.playerData) return null;
            return { playerData: data.playerData, lastSavedAt: data.lastSavedAt };
          })
          .catch(() => null);
      }
      console.error('CloudSyncService: failed to load player data:', error);
      return null;
    } finally {
      clearTimeout(firestoreTimeout);
    }
  }
}

export default new CloudSyncService();
