import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

/**
 * GDPR right-to-erasure + Apple Guideline 5.1.1(v) data cleanup.
 *
 * Fires whenever a Firebase Auth user is deleted — including the in-app
 * "Delete account" flow (the client calls currentUser.delete()) and any admin/console
 * deletion. The in-app flow already deletes players/{uid} client-side (while still
 * authenticated) BEFORE deleting the auth user, so this trigger is a server-side BACKSTOP:
 * it guarantees cleanup if the client couldn't finish (app killed mid-flow, client-side
 * delete failed) and covers console/admin deletions. Uses the Admin SDK (bypasses security
 * rules). This is the single place to extend as the data model grows: add any new per-user
 * collections/subcollections below. Deleting a missing doc is a safe no-op (the common case
 * here, since the client usually deleted it already).
 *
 * Note: `auth.user().onDelete` is a Gen-1-only trigger.
 */
export const onUserDeleted = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  try {
    await getFirestore().collection('players').doc(uid).delete();
    logger.info('Deleted player data on account deletion', { uid });
  } catch (err) {
    // Throw so Functions retries — we don't want to silently leave orphaned user data.
    logger.error('Failed to delete player data on account deletion', { uid, err });
    throw err;
  }
});
