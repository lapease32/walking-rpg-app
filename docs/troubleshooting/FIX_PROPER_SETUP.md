# Proper React Native Setup Fix

## The Real Issue

The `metro-cache-key` error occurs because the project wasn't initialized with React Native CLI, so dependency resolution isn't set up correctly. Nested `node_modules` are causing module resolution conflicts.

## Solution: Properly Initialize React Native Project

Since we've already written all the code, here's how to merge it with a properly initialized React Native project:

### Step 1: Back Up Your Code

```bash
cd "/Users/lancepease/Java Projects/Walking App"
cp -r src ~/Desktop/walking-app-src-backup
cp App.js ~/Desktop/walking-app-App-backup.js
```

### Step 2: Create a Fresh React Native Project in a Temp Location

```bash
cd ~/Desktop
npx react-native@0.72.6 init WalkingRPGTemp --version 0.72.6
```

### Step 3: Copy Your Code Back

```bash
# Copy your source code
cp -r ~/Desktop/walking-app-src-backup "/Users/lancepease/Java Projects/Walking App/src"

# Copy your App.js
cp ~/Desktop/walking-app-App-backup.js "/Users/lancepease/Java Projects/Walking App/App.js"

# Copy native folders from the temp project
cp -r ~/Desktop/WalkingRPGTemp/ios "/Users/lancepease/Java Projects/Walking App/"
cp -r ~/Desktop/WalkingRPGTemp/android "/Users/lancepease/Java Projects/Walking App/"
```

### Step 4: Update package.json with Your Dependencies

The temp project's `package.json` will have the correct React Native setup. You'll need to merge in your additional dependencies:

```json
{
  "@react-native-community/geolocation": "^3.3.2",
  "react-native-permissions": "^3.10.1",
  "@react-native-async-storage/async-storage": "^1.19.3"
}
```

### Step 5: Install Everything

```bash
cd "/Users/lancepease/Java Projects/Walking App"
rm -rf node_modules yarn.lock
yarn install

# iOS dependencies
cd ios && pod install && cd ..
```

### Step 6: Clean Up

```bash
rm -rf ~/Desktop/WalkingRPGTemp
```

## Alternative: Try This First (Simpler)

Before doing the full reinit, try this to force proper module resolution:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# Remove all node_modules
rm -rf node_modules

# Clear all caches
yarn cache clean
rm -rf ${TMPDIR:-/tmp}/metro-*
rm -rf ${TMPDIR:-/tmp}/react-*

# Reinstall with yarn
yarn install

# Try running
yarn ios
```

## Note on Package Manager

This project uses Yarn because the `resolutions` field in package.json only works with Yarn, not npm. Always use `yarn` commands instead of `npm`.

