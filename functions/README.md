# Cloud Functions

Server-side Firebase Cloud Functions for WalkingRPGApp.

## `onUserDeleted`

A Gen-1 `auth.user().onDelete` trigger that deletes a user's server-side data
(`players/{uid}`) when their Firebase Auth account is deleted. Backs the in-app
**Delete account** flow (GDPR right-to-erasure + Apple Guideline 5.1.1(v)).

The app deletes the **auth user** (`currentUser.delete()`); this trigger cascades the
**data** cleanup with the Admin SDK. Extend it as the data model grows (add new
per-user collections/subcollections here) so deletion stays correct and centralized.

## One-time project setup required to deploy (user-side)

Cloud Functions are **not** free-tier (Spark). To deploy this:

1. **Upgrade the Firebase project to the Blaze (pay-as-you-go) plan.** Practically ~$0
   for this — the trigger fires only on account deletion, well within the free tier —
   but Blaze requires a billing account on file.
2. **Enable APIs** (Google Cloud console): Cloud Functions, Cloud Build, Artifact Registry.
3. **Grant the CI deploy service account** (the identity behind `FIREBASE_SERVICE_ACCOUNT_KEY`)
   the **Cloud Functions Admin** and **Service Account User** roles.
4. **Set the repo variable `DEPLOY_FUNCTIONS=true`** (repo → Settings → Secrets and
   variables → Actions → **Variables**). This flips the `Deploy Firebase` workflow from
   "rules + indexes only" to also building + deploying functions.

Until step 4 is set, the `Deploy Firebase` workflow stays green and simply **skips**
functions (rules/indexes deploy as before) — so merging this code doesn't break CI.

## Local

```bash
cd functions
npm install
npm run build        # tsc → lib/
firebase emulators:start --only functions,firestore,auth
```
