# Android Setup & Testing Guide

## Current Status

✅ **Android Configuration Complete:**
- Location permissions added to AndroidManifest.xml
- App name matches iOS (WalkingRPGTemp)
- MainActivity correctly references component name
- Build configuration verified

## Android-Specific Configuration

### Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### App Name Consistency
- **Package**: `com.walkingrpgtemp`
- **Component Name**: `WalkingRPGTemp` (matches iOS)
- **App Name**: `WalkingRPGTemp` (in strings.xml)

## Setting Up Android Emulator

### Option 1: Android Studio Emulator (Recommended)

**Step 1: Install Android Studio**
1. Download from [developer.android.com/studio](https://developer.android.com/studio)
2. Install Android Studio
3. Open Android Studio and complete the setup wizard

**Step 2: Install Android SDK**
1. Open Android Studio
2. Go to **Tools → SDK Manager** (or click the SDK Manager icon)
3. In the **SDK Platforms** tab, check:
   - ✅ Android 13.0 (Tiramisu) - API Level 33 (or latest)
   - ✅ Android 12.0 (S) - API Level 31 (recommended minimum)
4. In the **SDK Tools** tab, ensure these are checked:
   - ✅ Android SDK Build-Tools
   - ✅ Android Emulator
   - ✅ Android SDK Platform-Tools
   - ✅ Intel x86 Emulator Accelerator (HAXM installer) - for Intel Macs
   - ✅ Google Play services
5. Click **Apply** and wait for installation

**Step 3: Create Virtual Device (AVD)**
1. In Android Studio, go to **Tools → Device Manager** (or click Device Manager icon)
2. Click **Create Device**
3. Choose a device:
   - **Recommended**: Pixel 5 or Pixel 6 (good balance of performance)
   - Or choose any device you prefer
4. Click **Next**
5. Select a system image:
   - **Recommended**: **API 33 (Android 13)** or **API 31 (Android 12)**
   - Make sure it shows "Download" if not installed - click it
   - Choose **x86_64** architecture (faster on Mac)
6. Click **Next**
7. Review and click **Finish**

**Step 4: Start the Emulator**
1. In Device Manager, click the ▶️ play button next to your device
2. Wait for emulator to boot (first time may take a few minutes)
3. Once booted, you'll see the Android home screen

**Step 5: Verify Emulator is Detected**
```bash
# Check if emulator is running
adb devices

# Should show something like:
# List of devices attached
# emulator-5554    device
```

### Option 2: Command Line (Advanced)

If you prefer command line:

```bash
# List available system images
sdkmanager --list | grep "system-images"

# Install a system image
sdkmanager "system-images;android-33;google_apis;x86_64"

# Create AVD from command line
avdmanager create avd -n Pixel5_API33 -k "system-images;android-33;google_apis;x86_64" -d "pixel_5"

# List AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel5_API33
```

### Option 3: Genymotion (Alternative)

- Commercial emulator (free for personal use)
- Often faster than Android Studio emulator
- Download from [genymotion.com](https://www.genymotion.com/)
- Good for testing but requires separate setup

### Option 4: Physical Device

**Via USB:**
1. Enable **Developer Options** on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable **USB Debugging**:
   - Settings → Developer Options → USB Debugging (ON)
3. Connect phone via USB
4. Accept the USB debugging prompt on your phone
5. Verify: `adb devices` should show your device

**Via WiFi (Android 11+):**
1. Connect phone and computer to same WiFi
2. Enable USB debugging (see above)
3. Connect via USB first, then:
   ```bash
   adb tcpip 5555
   adb connect <phone-ip-address>:5555
   ```
4. You can now disconnect USB

## Testing Android Build

### Prerequisites
1. Android Studio installed ✅
2. Android SDK installed (API 21+) ✅
3. Android Emulator running OR physical device connected via USB ✅

### Build & Run

```bash
# Start Metro bundler (in one terminal)
yarn start

# Build and run on Android (in another terminal)
yarn android
```

### Alternative: Build APK

```bash
cd android
./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

## Android-Specific Considerations

### Location Permissions
- Android 6.0+ (API 23+) requires **runtime permission requests**
- `@react-native-community/geolocation` handles this automatically
- User will see permission dialog on first location access

### Testing Location on Emulator

**Method 1: Using Extended Controls**
1. With emulator running, click the **"..." (three dots)** button on the emulator toolbar
2. Go to **"Location"** tab
3. You can:
   - Enter coordinates manually (lat, lon)
   - Use presets (like "Tokyo", "Paris", etc.)
   - Click **"Set Location"** to apply
4. To simulate movement:
   - Set a starting location
   - Click "Set Location"
   - Change coordinates slightly (move ~0.0001 degrees = ~10 meters)
   - Click "Set Location" again
   - Repeat to simulate walking

**Method 2: Using ADB Commands**
```bash
# Set a specific location
adb emu geo fix -122.4194 37.7749  # longitude latitude (San Francisco)

# Simulate movement (walking north)
adb emu geo fix -122.4194 37.7750  # moved ~10 meters north
adb emu geo fix -122.4194 37.7751  # moved another ~10 meters
```

**Method 3: Using Debug Mode in App**
- The debug mode we added works great on emulator!
- Click "Simulate Location Update" to fake GPS movement
- Click "Simulate 100m Movement" to add distance
- Much easier than manually setting coordinates!

### Debug Features
The debug mode added to HomeScreen works on Android too:
- "Simulate Location Update" - Simulates GPS movement
- "Simulate 100m Movement" - Adds distance
- "Force Encounter" - Triggers encounter immediately

## Common Android Issues

### Build Errors
- **Gradle sync issues**: Run `cd android && ./gradlew clean`
- **SDK not found**: Check Android Studio SDK path
- **NDK issues**: Verify NDK version in `android/build.gradle`

### Runtime Issues
- **Location not working**: Check if permissions were granted in device settings
- **App crashes on start**: Check Metro bundler is running
- **Red screen errors**: Check Metro bundler logs

### Permission Issues
If location doesn't work:
1. Check device Settings → Apps → WalkingRPGTemp → Permissions
2. Ensure "Location" permission is granted
3. For Android 10+, may need "Allow all the time" for background tracking

## Next Steps

1. **Test Build**: Try `yarn android` to verify build works
2. **Test Location**: Verify location permissions are requested and work
3. **Test Encounters**: Use debug mode to test encounter system
4. **Compare with iOS**: Ensure both platforms behave similarly

## Platform Differences

| Feature | iOS | Android |
|---------|-----|---------|
| Permission Request | Info.plist + Runtime | AndroidManifest.xml + Runtime |
| Location Library | Same (`@react-native-community/geolocation`) | Same |
| Debug Mode | Works | Works |
| Component Name | WalkingRPGTemp | WalkingRPGTemp ✅ |

