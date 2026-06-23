# iOS TestFlight release (fastlane)

On-demand TestFlight releases via the **iOS Release (TestFlight)** GitHub Action
(`.github/workflows/ios-release.yml`), which runs the `beta` lane in
[`ios/fastlane/Fastfile`](../ios/fastlane/Fastfile).

Once the one-time setup below is done, cutting a build is: **Actions → iOS Release (TestFlight) →
Run workflow → branch `main`**. The build number is set to `latest TestFlight build + 1`
automatically, so you can release any time without touching version numbers.

How it works:
- **Auth** — an App Store Connect **API key** (no Apple ID password / 2FA in CI).
- **Signing** — fastlane **match**: the distribution certificate + App Store provisioning profile
  are generated once and stored *encrypted* in a separate private git repo. CI pulls them in
  **readonly** mode and never mutates them.

---

## One-time setup

### 1. App Store Connect API key

App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys** →
**+** → name it (e.g. `CI`), access **App Manager** → **Generate**.

- Download the **`AuthKey_XXXXXX.p8`** (you can only download it once).
- Note the **Key ID** and the **Issuer ID** (shown above the keys table).

### 2. Bootstrap match (creates + stores your signing assets)

1. Create a **new empty private GitHub repo** to hold the encrypted certs, e.g.
   `lapease32/ios-certificates`. Nothing else goes in it.
2. Locally, from `ios/`:
   ```bash
   bundle install                      # installs fastlane (needs Ruby ≥ 2.7; rbenv/rvm if your system Ruby is older)
   export MATCH_GIT_URL="https://github.com/lapease32/ios-certificates.git"
   bundle exec fastlane match appstore # prompts for a passphrase → remember it (this is MATCH_PASSWORD)
   ```
   This generates the Apple Distribution cert + the `com.lancepease.walkingrpg` App Store profile,
   encrypts them with your passphrase, and pushes them to the certs repo. Run it on a Mac that can
   sign in to your Apple Developer account (or pass the API key — see `fastlane match --help`).

### 3. Add the GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ASC_KEY_ID` | the API **Key ID** from step 1 |
| `ASC_ISSUER_ID` | the **Issuer ID** from step 1 |
| `ASC_KEY_CONTENT` | base64 of the `.p8`: `base64 -i AuthKey_XXXXXX.p8 \| pbcopy` |
| `MATCH_GIT_URL` | HTTPS URL of the certs repo (e.g. `https://github.com/lapease32/ios-certificates.git`) |
| `MATCH_PASSWORD` | the passphrase you chose in step 2 |
| `MATCH_GIT_BASIC_AUTHORIZATION` | base64 of `username:PAT` so CI can clone the private certs repo: `echo -n "lapease32:ghp_xxx" \| base64` (PAT needs `repo` read on the certs repo) |

`GOOGLE_SERVICES_INFO_PLIST` is already configured (reused from the existing iOS build).

### 4. Release

**Actions → iOS Release (TestFlight) → Run workflow → `main`.** The build uploads to TestFlight;
testers are notified once Apple finishes processing it (a few minutes).

---

## Notes

- **Internal testers** get the build with no review. **External testers** need Beta App Review on
  the *first* build only; routine builds after that normally skip re-review.
- The cert match created auto-**renews** via `fastlane match` — if it ever expires, re-run
  `bundle exec fastlane match appstore` locally to refresh the certs repo.
- The lane forces **manual signing** in CI (the project default is automatic, which conflicts with
  match-provided assets). It does not change how the app signs when you build locally in Xcode.
