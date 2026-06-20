import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from '@react-native-firebase/firestore';
import { PlayerData } from '../models/Player';

export interface CloudPlayerRecord {
  playerData: PlayerData;
  lastSavedAt: number;
}

/**
 * Outcome of a cloud read, kept DISTINCT so callers never confuse "the cloud has no save"
 * with "we couldn't read the cloud". Treating a timed-out/failed read as `empty` is what let a
 * fresh level-1 character overwrite a real save — so a failed/timed-out read is `unavailable`,
 * and only a confirmed-missing document is `empty`.
 */
export type CloudLoad =
  | { status: 'found'; record: CloudPlayerRecord }
  | { status: 'empty' }
  | { status: 'unavailable' };

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

  /**
   * Permanently delete the current user's players/{uid} document — the PRIMARY cloud-erasure
   * path for account deletion. Run client-side while the user is still authenticated (the
   * Firestore rules only allow a client to delete its own doc, request.auth.uid == uid), so
   * the caller must invoke this BEFORE deleting the auth account. This makes cloud erasure
   * work without the onUserDeleted Cloud Function deployed; the function is a server-side
   * backstop for the rare case the app dies between this and the auth deletion.
   *
   * Bounded by a timeout and throws on failure (or timeout) so the caller aborts the auth
   * deletion rather than deleting the account and orphaning the cloud doc. Deleting a
   * non-existent doc is a successful no-op (covers anonymous / never-synced users).
   */
  async deletePlayerData(timeoutMs: number = 10000): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) {
      // No signed-in user → nothing this client could delete (and no rights to). The auth
      // layer handles the no-user case; treat as a no-op here.
      return;
    }
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Cloud data deletion timed out')),
        timeoutMs,
      );
    });
    const deletePromise = deleteDoc(doc(collection(getFirestore(), 'players'), user.uid));
    // Swallow a late rejection so it isn't surfaced as an unhandled rejection if the
    // timeout wins the race; the awaited race still rejects via `timeout`.
    deletePromise.catch(() => {});
    try {
      await Promise.race([deletePromise, timeout]);
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

  async loadPlayerData(): Promise<CloudLoad> {
    const user = getAuth().currentUser;
    if (!user) {
      // No auth session → cloud state is UNKNOWN, not empty. Reporting 'empty' here would let
      // a missing session trigger a fresh-character overwrite.
      return { status: 'unavailable' };
    }
    // Race the Firestore get against a 10-second timeout. The Firestore SDK can stall
    // indefinitely on its first gRPC connection (slow network, Android New-Arch cold start),
    // and a stall must surface as 'unavailable' — NOT 'empty' — so it can't cause an overwrite.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<CloudLoad>(resolve => {
      timeoutHandle = setTimeout(() => {
        console.warn('CloudSyncService: loadPlayerData timed out — cloud state unknown');
        resolve({ status: 'unavailable' });
      }, 10000);
    });
    // .catch on the fetch chain so a late rejection (after the timeout already won the race)
    // can't surface as an unhandled rejection; it just resolves to 'unavailable'.
    const fetch = getDoc(doc(collection(getFirestore(), 'players'), user.uid))
      .then<CloudLoad>(snapshot => {
        if (!snapshot.exists) return { status: 'empty' };
        const data = snapshot.data() as { playerData: PlayerData; lastSavedAt: number } | undefined;
        if (!data?.playerData) return { status: 'empty' };
        return {
          status: 'found',
          record: { playerData: data.playerData, lastSavedAt: data.lastSavedAt },
        };
      })
      .catch((error): CloudLoad => {
        console.error('CloudSyncService: failed to load player data:', error);
        return { status: 'unavailable' };
      });
    try {
      return await Promise.race([fetch, timeout]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

export default new CloudSyncService();
