# Cloud Functions

Server-side Firebase Cloud Functions for WalkingRPGApp.

## `onUserDeleted`

A Gen-1 `auth.user().onDelete` trigger that deletes a user's server-side data
(`players/{uid}`) when their Firebase Auth account is deleted. **Backstop** for the in-app
**Delete account** flow (GDPR right-to-erasure + Apple Guideline 5.1.1(v)).

The in-app flow does the real work client-side: it deletes `players/{uid}` (while still
authenticated — the security rules allow an owner to delete their own doc) and then deletes
the **auth user** (`currentUser.delete()`). So **cloud erasure works without this function
deployed.** This trigger is defense-in-depth: it guarantees cleanup if the client couldn't
finish (app killed mid-flow, client-side delete failed) and covers console/admin deletions,
using the Admin SDK. Extend it as the data model grows (add new per-user
collections/subcollections here) so the backstop stays complete.

## One-time project setup required to deploy (user-side)

Deploying the function is **recommended** (it closes the app-killed-mid-deletion gap) but
**not required for the feature to function** — client-side erasure covers the normal path.
Cloud Functions are **not** free-tier (Spark). To deploy this backstop:

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
