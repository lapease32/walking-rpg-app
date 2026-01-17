# Fix Setup Issues

## The Problem

The error `Cannot find module 'metro-cache-key'` occurs because:
1. Native iOS/Android project folders are missing
2. Dependencies may not be fully installed

## Solution

Since we've already created the JavaScript source code, we need to scaffold the native projects. Here's how to fix it:

### Option 1: Initialize React Native Project Structure (Recommended)

**Important**: Back up your `src/` folder first!

1. **In a temporary location, create a fresh React Native project:**
   ```bash
   cd ~/Desktop  # or another temp location
   npx react-native@0.72.6 init WalkingRPGTemp --version 0.72.6
   ```

2. **Copy the native folders to your project:**
   ```bash
   cp -r WalkingRPGTemp/ios "/Users/lancepease/Java Projects/Walking App/"
   cp -r WalkingRPGTemp/android "/Users/lancepease/Java Projects/Walking App/"
   cp WalkingRPGTemp/.watchmanconfig "/Users/lancepease/Java Projects/Walking App/" 2>/dev/null || true
   ```

3. **Clean up:**
   ```bash
   rm -rf WalkingRPGTemp
   ```

4. **Update iOS project name (if needed):**
   - The iOS project will be named "WalkingRPGTemp" by default
   - You may want to rename it to match your app name
   - Or just use it as-is for now

5. **Install iOS dependencies:**
   ```bash
   cd "/Users/lancepease/Java Projects/Walking App/ios"
   pod install
   cd ..
   ```

6. **Reinstall dependencies:**
   ```bash
   cd "/Users/lancepease/Java Projects/Walking App"
   rm -rf node_modules yarn.lock
   yarn install
   ```

### Option 2: Use React Native CLI (Alternative)

If the above doesn't work, you can try:

```bash
cd "/Users/lancepease/Java Projects/Walking App"
npx @react-native-community/cli init --skip-install --directory . --name WalkingRPG
```

Then merge your existing `src/` folder and configuration files.

### After Setup

1. **Configure iOS permissions** (add to `ios/WalkingRPGTemp/Info.plist`):
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>This app needs location access to track your walks.</string>
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>This app needs location access to track your walks.</string>
   ```

2. **Configure Android permissions** (add to `android/app/src/main/AndroidManifest.xml`):
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   ```

3. **Try running again:**
   ```bash
   yarn ios
   ```

### Quick Check

Verify you have the required folders:
```bash
ls -la ios android
```

Both directories should exist with native project files inside.

