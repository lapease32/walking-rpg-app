# Adding Native iOS/Android Folders - Manual Steps

Since React Native CLI is having version conflicts, here's a simpler manual approach to get the native folders you need.

## Option 1: Use Expo (Recommended - Easiest)

Expo handles native projects more reliably. You can create a bare Expo project which gives you full React Native access:

```bash
# Make sure you're on Node 18
nvm use 18

# Create Expo project
cd ~/Desktop
npx create-expo-app@latest WalkingRPGTemp --template bare-minimum

# Copy ios/android folders
cp -r WalkingRPGTemp/ios "/Users/lancepease/Java Projects/Walking App/"
cp -r WalkingRPGTemp/android "/Users/lancepease/Java Projects/Walking App/"

# Clean up
rm -rf WalkingRPGTemp
```

Then in your project:
```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"
pod install
cd ..
```

## Option 2: Download Template from GitHub

React Native's template is available on GitHub:

```bash
cd ~/Desktop

# Download React Native 0.72.6 release
curl -L https://github.com/facebook/react-native/archive/v0.72.6.tar.gz -o rn-0.72.6.tar.gz

# Extract
tar -xzf rn-0.72.6.tar.gz

# Copy template folders
cp -r react-native-0.72.6/packages/react-native/template/ios "/Users/lancepease/Java Projects/Walking App/"
cp -r react-native-0.72.6/packages/react-native/template/android "/Users/lancepease/Java Projects/Walking App/"

# Clean up
rm -rf react-native-0.72.6 rn-0.72.6.tar.gz
```

Then update project names:
```bash
cd "/Users/lancepease/Java Projects/Walking App/ios"
# Update project name from template default to WalkingRPG
find . -type f \( -name "*.pbxproj" -o -name "*.plist" -o -name "Podfile" \) -exec sed -i '' 's/HelloWorld/WalkingRPG/g' {} \;
mv HelloWorld.xcodeproj WalkingRPG.xcodeproj 2>/dev/null || true
mv HelloWorld WalkingRPG 2>/dev/null || true

pod install
cd ..
```

## Option 3: Try React Native CLI One More Time (with workaround)

```bash
# Make sure Node 18
nvm use 18
node --version  # Must be v18.x.x

cd ~/Desktop

# Create project with explicit npm (not yarn)
npx --yes @react-native-community/cli@11.3.9 init WalkingRPGTemp \
  --directory . \
  --skip-install \
  --version 0.72.6 \
  --npm

# If that creates the project, copy folders
if [ -d "WalkingRPGTemp/ios" ]; then
  cp -r WalkingRPGTemp/ios "/Users/lancepease/Java Projects/Walking App/"
  cp -r WalkingRPGTemp/android "/Users/lancepease/Java Projects/Walking App/"
  rm -rf WalkingRPGTemp
fi
```

## After Adding Native Folders

1. **Install iOS dependencies:**
   ```bash
   cd "/Users/lancepease/Java Projects/Walking App/ios"
   pod install
   cd ..
   ```

2. **Add iOS location permissions** to `ios/WalkingRPG/Info.plist`:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>This app needs location access to track your walks.</string>
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>This app needs location access to track your walks.</string>
   ```

3. **Add Android location permissions** to `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   ```

4. **Test:**
   ```bash
   npm install  # Make sure all JS dependencies are installed
   npm run ios  # Try running
   ```

## Which Option to Choose?

- **Option 1 (Expo)**: Easiest and most reliable
- **Option 2 (GitHub)**: Most direct, guaranteed to work
- **Option 3 (CLI)**: Try if you want to use official CLI

I'd recommend **Option 1 (Expo)** as it's the most straightforward and handles all the complexity for you.

