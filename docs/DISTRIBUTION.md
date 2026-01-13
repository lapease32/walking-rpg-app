# App Distribution Guide for Beta Testing

This guide covers several options for distributing your Walking RPG app to friends for testing without needing physical access to their devices.

## Quick Comparison

| Method | iOS | Android | Cost | Setup Complexity | Best For |
|--------|-----|---------|------|------------------|----------|
| **TestFlight** | ✅ | ❌ | $99/year | Medium | iOS-only testing |
| **Google Play Internal Testing** | ❌ | ✅ | $25 one-time | Medium | Android-only testing |
| **Firebase App Distribution** | ✅ | ✅ | Free | Easy | Both platforms, small groups |
| **App Center** | ✅ | ✅ | Free tier | Medium | Both platforms, CI/CD integration |
| **Direct APK/IPA** | ✅ | ✅ | Free | Hard | Technical users only |

---

## Option 1: Firebase App Distribution (Recommended for Small Groups)

**Best for:** Quick setup, both iOS and Android, free, small groups of testers

### Setup Steps:

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project (or use existing)
   - Add iOS and Android apps to the project

2. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **Install App Distribution Plugin**
   ```bash
   npm install --save-dev @react-native-firebase/app-distribution
   ```

4. **Build and Upload iOS**
   ```bash
   # Build iOS release
   cd ios
   xcodebuild -workspace WalkingRPGTemp.xcworkspace \
     -scheme WalkingRPGTemp \
     -configuration Release \
     -archivePath build/WalkingRPGTemp.xcarchive \
     archive
   
   # Export IPA (requires signing)
   xcodebuild -exportArchive \
     -archivePath build/WalkingRPGTemp.xcarchive \
     -exportPath build \
     -exportOptionsPlist ExportOptions.plist
   
   # Upload to Firebase
   firebase appdistribution:distribute build/WalkingRPGTemp.ipa \
     --app YOUR_IOS_APP_ID \
     --groups "testers"
   ```

5. **Build and Upload Android**
   ```bash
   # Build Android release APK
   cd android
   ./gradlew assembleRelease
   
   # Upload to Firebase
   firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
     --app YOUR_ANDROID_APP_ID \
     --groups "testers"
   ```

6. **Add Testers**
   - In Firebase Console → App Distribution
   - Create a tester group (e.g., "Friends")
   - Add tester emails
   - Testers receive email with download link

**Pros:**
- Free
- Works for both platforms
- Easy email-based distribution
- Automatic updates notifications

**Cons:**
- iOS requires Apple Developer account ($99/year) for signing
- Limited to 10,000 testers per app

---

## Option 2: TestFlight (iOS Only)

**Best for:** Official iOS beta testing, up to 10,000 testers

### Requirements:
- Apple Developer Account ($99/year)
- App Store Connect access

### Setup Steps:

1. **Archive Your App in Xcode**
   ```bash
   # Open Xcode
   open ios/WalkingRPGTemp.xcworkspace
   
   # In Xcode:
   # 1. Select "Any iOS Device" as target
   # 2. Product → Archive
   # 3. Wait for archive to complete
   ```

2. **Upload to App Store Connect**
   - In Xcode Organizer, click "Distribute App"
   - Choose "App Store Connect"
   - Follow the wizard to upload

3. **Configure TestFlight**
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Select your app → TestFlight tab
   - Add internal testers (up to 100) or external testers (up to 10,000)
   - Add tester emails
   - Testers receive email invitation

**Pros:**
- Official Apple solution
- Up to 10,000 external testers
- Easy for testers (just install TestFlight app)
- Automatic updates

**Cons:**
- iOS only
- Requires Apple Developer account
- App review for external testers (can take 24-48 hours)

---

## Option 3: Google Play Internal Testing (Android Only)

**Best for:** Official Android beta testing

### Requirements:
- Google Play Developer Account ($25 one-time fee)

### Setup Steps:

1. **Create Release Build**
   ```bash
   cd android
   ./gradlew bundleRelease  # Creates AAB file
   # OR
   ./gradlew assembleRelease  # Creates APK file
   ```

2. **Upload to Google Play Console**
   - Go to [Google Play Console](https://play.google.com/console/)
   - Create app (if not exists)
   - Go to Testing → Internal testing
   - Create new release
   - Upload AAB or APK file
   - Add tester emails (up to 100 internal testers)

3. **Share Testing Link**
   - Google Play provides a testing link
   - Share with testers
   - They can install directly from Play Store

**Pros:**
- Official Google solution
- Easy installation for testers
- Automatic updates
- No app review needed for internal testing

**Cons:**
- Android only
- Requires Google Play Developer account
- Limited to 100 internal testers (closed testing allows more)

---

## Option 4: App Center (Microsoft)

**Best for:** CI/CD integration, both platforms

### Setup Steps:

1. **Create App Center Account**
   - Go to [App Center](https://appcenter.ms/)
   - Sign up with GitHub/Microsoft account

2. **Create App**
   - Add new app (iOS and Android separately)
   - Get API tokens

3. **Install App Center CLI**
   ```bash
   npm install -g appcenter-cli
   appcenter login
   ```

4. **Upload Builds**
   ```bash
   # iOS
   appcenter distribute release \
     --app YOUR_ORG/WalkingRPG-iOS \
     --file path/to/app.ipa \
     --group "Friends"
   
   # Android
   appcenter distribute release \
     --app YOUR_ORG/WalkingRPG-Android \
     --file path/to/app.apk \
     --group "Friends"
   ```

5. **Add Testers**
   - In App Center dashboard
   - Create distribution group
   - Add tester emails
   - Testers receive email with download link

**Pros:**
- Free tier available
- Both platforms
- CI/CD integration
- Crash reporting included

**Cons:**
- More setup required
- Free tier has limitations

---

## Option 5: Direct Distribution (Advanced)

**Best for:** Technical testers, quick testing

### Android (APK):
1. Build release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
2. APK location: `android/app/build/outputs/apk/release/app-release.apk`
3. Share via:
   - Email attachment
   - Google Drive/Dropbox link
   - Personal website
4. Testers enable "Install from unknown sources" in Android settings

### iOS (IPA):
1. Build and archive in Xcode
2. Export IPA with ad-hoc distribution
3. Register testers' device UDIDs in Apple Developer Portal
4. Share IPA file
5. Testers install via:
   - iTunes (older method)
   - Xcode
   - Third-party tools like AltStore

**Pros:**
- No third-party services
- Full control

**Cons:**
- iOS requires device registration (max 100 devices per year)
- More technical for testers
- No automatic updates
- Security concerns with direct file sharing

---

## Recommended Approach

For a **small group of friends** testing both iOS and Android:

1. **Start with Firebase App Distribution** (easiest, free, both platforms)
2. **For iOS:** If you have Apple Developer account, also use TestFlight for better experience
3. **For Android:** Use Google Play Internal Testing if you have Play Developer account

---

## Quick Start: Firebase App Distribution

Here's a minimal setup script you can add to your project:

### Create `scripts/distribute.sh`:

```bash
#!/bin/bash

# Firebase App Distribution Script
# Usage: ./scripts/distribute.sh [ios|android]

PLATFORM=$1
FIREBASE_IOS_APP_ID="your-ios-app-id"
FIREBASE_ANDROID_APP_ID="your-android-app-id"
TESTER_GROUP="friends"

if [ "$PLATFORM" == "ios" ]; then
  echo "Building iOS..."
  cd ios
  xcodebuild -workspace WalkingRPGTemp.xcworkspace \
    -scheme WalkingRPGTemp \
    -configuration Release \
    -archivePath build/WalkingRPGTemp.xcarchive \
    archive
  
  xcodebuild -exportArchive \
    -archivePath build/WalkingRPGTemp.xcarchive \
    -exportPath build \
    -exportOptionsPlist ExportOptions.plist
  
  firebase appdistribution:distribute build/WalkingRPGTemp.ipa \
    --app $FIREBASE_IOS_APP_ID \
    --groups $TESTER_GROUP
  
elif [ "$PLATFORM" == "android" ]; then
  echo "Building Android..."
  cd android
  ./gradlew assembleRelease
  
  firebase appdistribution:distribute app/build/outputs/apk/release/app-release.apk \
    --app $FIREBASE_ANDROID_APP_ID \
    --groups $TESTER_GROUP
  
else
  echo "Usage: ./scripts/distribute.sh [ios|android]"
fi
```

---

## Notes

- **iOS Signing:** All iOS distribution methods require proper code signing with an Apple Developer account
- **Android Signing:** Release builds should be signed with a keystore (create one if you haven't)
- **Privacy:** Make sure testers understand they're testing a beta app
- **Feedback:** Set up a way to collect feedback (email, Discord, etc.)

---

## Next Steps

1. Choose your distribution method
2. Set up the necessary accounts (if required)
3. Create your first test build
4. Add your friends as testers
5. Share the download link/invitation

For questions or issues, refer to the official documentation:
- [Firebase App Distribution](https://firebase.google.com/docs/app-distribution)
- [TestFlight](https://developer.apple.com/testflight/)
- [Google Play Internal Testing](https://support.google.com/googleplay/android-developer/answer/9845334)
