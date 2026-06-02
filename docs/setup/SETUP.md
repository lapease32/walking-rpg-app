# Setup Guide

Detailed setup for building and running StrideQuest locally. For a high-level overview see the [README](../../README.md); for design, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- **Node.js 20+** (CI uses 22) and **Yarn**
- **iOS:** macOS, Xcode, and CocoaPods (via Bundler: `gem install bundler`)
- **Android:** Android Studio, the Android SDK, and **JDK 17**

## 1. Firebase config (required — not committed)

The app initializes Firebase natively, so the build needs these two files, which are **gitignored**:

- `android/app/google-services.json`
- `ios/WalkingRPGTemp/GoogleService-Info.plist`

Provide your own from a Firebase project (Project Settings → Your apps → download), or, in CI, they're injected from base64 secrets. Without them, the native build fails.

## 2. Install dependencies

```bash
yarn install
cd ios && bundle install && bundle exec pod install && cd ..   # iOS only
```

## 3. Run

```bash
yarn start          # Metro bundler
yarn ios            # build + run on iOS
yarn android        # build + run on Android
```

Or open `ios/WalkingRPGTemp.xcworkspace` in Xcode (the **workspace**, not the `.xcodeproj`) and run from there.

> Location permissions are already declared — `ios/WalkingRPGTemp/Info.plist` (the `NSLocation*` keys) and `android/app/src/main/AndroidManifest.xml`. No manual editing needed.

## Testing the walk loop without walking

Encounters trigger from GPS distance, so to test indoors you simulate movement:

- **iOS Simulator:** Features → Location → pick a route/location (or a custom coordinate, changed over time).
- **Android Emulator:** Extended Controls (•••) → Location → set points or play a GPX/KML route.

A real device walking outdoors is still the most representative test.

## Common build resets

```bash
yarn start --reset-cache                      # Metro cache
cd ios && bundle exec pod install && cd ..     # iOS pods
cd android && ./gradlew clean && cd ..          # Android build
```

## See also

- [ANDROID_SETUP.md](ANDROID_SETUP.md) — Android SDK / emulator specifics
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the app is structured
