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
      // set() instead of runTransaction so Firestore's offline persistence can queue
      // the write locally and flush when connectivity returns. Out-of-order write
      // protection is enforced server-side by the lastSavedAt rule in firestore.rules.
      await firestore().collection('players').doc(user.uid).set({ playerData, lastSavedAt });
    } catch (error) {
      console.error('CloudSyncService: failed to save player data:', error);
      // Non-fatal — local save already succeeded; offline persistence will retry
    }
  }

  async loadPlayerData(): Promise<CloudPlayerRecord | null> {
    const user = auth().currentUser;
    if (!user) {
      return null;
    }
    try {
      // Race the Firestore get against a 10-second timeout. The Firestore SDK can
      // stall indefinitely on its first gRPC connection (slow network, emulator cold
      // start, etc.) — without a timeout the app hangs on "Loading..." forever.
      let timedOut = false;
      const timeout = new Promise<null>(resolve =>
        setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, 10000),
      );
      const fetch = firestore()
        .collection('players')
        .doc(user.uid)
        .get()
        .then(doc => {
          if (!doc.exists) return null;
          const data = doc.data() as { playerData: PlayerData; lastSavedAt: number } | undefined;
          if (!data?.playerData) return null;
          return { playerData: data.playerData, lastSavedAt: data.lastSavedAt };
        });
      const result = await Promise.race([fetch, timeout]);
      if (timedOut) {
        console.warn('CloudSyncService: loadPlayerData timed out — falling back to local storage');
      }
      return result;
    } catch (error) {
      console.error('CloudSyncService: failed to load player data:', error);
      return null;
    }
  }
}

export default new CloudSyncService();
