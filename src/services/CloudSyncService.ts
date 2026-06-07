import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc } from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

export interface CloudPlayerRecord {
  playerData: PlayerData;
  lastSavedAt: number;
}

class CloudSyncService {
  // Ensures strictly-increasing Firestore timestamps across rapid successive saves.
  // At walking pace saves are seconds apart so this is normally a no-op, but the
  // Firestore update rule requires strict-greater and this makes that invariant
  // impossible to violate regardless of clock resolution.
  private lastSyncTimestamp: number = 0;
  // When true, savePlayerData is a no-op. Set during account deletion so a NEW fire-and-forget
  // save can't recreate players/{uid} after the doc + auth user are deleted (which would defeat
  // erasure). Blocks new calls only — in-flight writes are handled by drainPendingWrites.
  // Reset once a fresh session is established.
  private writesSuspended: boolean = false;
  // The most recent in-flight setDoc, chained so concurrent saves are all awaited. Account
  // deletion calls drainPendingWrites() after suspendWrites() to let a save already awaiting
  // setDoc finish BEFORE players/{uid} is deleted — otherwise that late write resurrects the
  // doc. Each segment self-catches so the chain never rejects or stays pending on failure.
  private pendingWrite: Promise<void> = Promise.resolve();

  suspendWrites(): void {
    this.writesSuspended = true;
  }

  resumeWrites(): void {
    this.writesSuspended = false;
  }

  /**
   * Await any in-flight cloud write, bounded by a timeout. Called during account deletion
   * AFTER suspendWrites() so a save already awaiting setDoc completes before players/{uid}
   * is deleted (preventing a late write from resurrecting the doc). Bounded because setDoc
   * has no timeout of its own and can sit in the offline queue indefinitely — we must not
   * block the user's deletion on it.
   */
  async drainPendingWrites(timeoutMs: number = 3000): Promise<void> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => {
      timeoutHandle = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([this.pendingWrite, timeout]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async savePlayerData(playerData: PlayerData, lastSavedAt: number): Promise<void> {
    if (this.writesSuspended) {
      return;
    }
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    const syncTimestamp = Math.max(lastSavedAt, this.lastSyncTimestamp + 1);
    this.lastSyncTimestamp = syncTimestamp;
    // setDoc() instead of runTransaction so Firestore's offline persistence can queue
    // the write locally and flush when connectivity returns. Out-of-order write
    // protection is enforced server-side by the lastSavedAt rule in firestore.rules.
    const write = setDoc(doc(collection(getFirestore(), 'players'), user.uid), {
      playerData,
      lastSavedAt: syncTimestamp,
    })
      .then(() => {})
      .catch(error => {
        console.error('CloudSyncService: failed to save player data:', error);
        // Non-fatal — local save already succeeded; offline persistence will retry
      });
    // Track for drainPendingWrites. Chain onto the prior write so concurrent saves are all
    // awaited; each segment self-catches above so the chain never rejects.
    this.pendingWrite = this.pendingWrite.then(() => write);
    await write;
  }

  async loadPlayerData(): Promise<CloudPlayerRecord | null> {
    const user = getAuth().currentUser;
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
      const fetch = getDoc(doc(collection(getFirestore(), 'players'), user.uid)).then(snapshot => {
        if (!snapshot.exists) return null;
        const data = snapshot.data() as { playerData: PlayerData; lastSavedAt: number } | undefined;
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
