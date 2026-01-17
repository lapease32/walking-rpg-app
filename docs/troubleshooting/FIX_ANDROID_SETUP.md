# Fix Android Setup Issues

## Issues Found

1. ❌ **Java/JDK not installed** - Required for Android builds
2. ❌ **ADB not in PATH** - Android SDK tools not accessible
3. ❌ **No emulator created** - Need to set up an Android Virtual Device (AVD)

## Step-by-Step Fix

### Step 1: Install Java Development Kit (JDK)

**Option A: Using Homebrew (Recommended)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install JDK 17 (required for React Native 0.72)
brew install openjdk@17

# Link it so it's available system-wide
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk

# Add to your shell profile (~/.zshrc)
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@17"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
java -version
# Should show: openjdk version "17.x.x"
```

**Option B: Download from Oracle/Adoptium**
1. Go to [adoptium.net](https://adoptium.net/)
2. Download JDK 17 for macOS (ARM64 if you have M1/M2 Mac, x64 for Intel)
3. Install the .pkg file
4. Set JAVA_HOME:
   ```bash
   export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
   export PATH=$JAVA_HOME/bin:$PATH
   ```

### Step 2: Set Up Android SDK Path

**Find your Android SDK location:**
- Usually at: `~/Library/Android/sdk` (default on Mac)
- Or check Android Studio: **Preferences → Appearance & Behavior → System Settings → Android SDK**
- Look for "Android SDK Location"

**Add to your shell profile (~/.zshrc):**
```bash
# Add these lines to ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# Reload your shell
source ~/.zshrc

# Verify ADB is now accessible
adb version
```

**If Android SDK is in a different location:**
```bash
# Replace with your actual SDK path
export ANDROID_HOME=/path/to/your/android/sdk
```

### Step 3: Create Android Emulator

**Using Android Studio (Easiest):**
1. Open Android Studio
2. Click **More Actions → Virtual Device Manager** (or Tools → Device Manager)
3. Click **Create Device**
4. Choose a device (e.g., **Pixel 5**)
5. Click **Next**
6. Download a system image if needed:
   - Click **Download** next to **API 33 (Android 13)** or **API 31 (Android 12)**
   - Choose **x86_64** architecture (for Intel Mac) or **arm64-v8a** (for M1/M2 Mac)
   - Wait for download to complete
7. Select the downloaded image and click **Next**
8. Review settings and click **Finish**
9. Click the ▶️ play button to start the emulator

**Using Command Line:**
```bash
# List available system images
sdkmanager --list | grep "system-images"

# Install a system image (API 33, x86_64)
sdkmanager "system-images;android-33;google_apis;x86_64"

# Create AVD
avdmanager create avd -n Pixel5_API33 -k "system-images;android-33;google_apis;x86_64" -d "pixel_5"

# List created AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel5_API33 &
```

### Step 4: Verify Setup

```bash
# Check Java
java -version
# Should show: openjdk version "17.x.x"

# Check ADB
adb version
# Should show: Android Debug Bridge version x.x.x

# Check emulator
emulator -list-avds
# Should show your created emulator(s)

# Check Android SDK
echo $ANDROID_HOME
# Should show: /Users/yourname/Library/Android/sdk
```

### Step 5: Try Building Again

```bash
# Make sure emulator is running first
# Then in your project directory:

yarn android
```

## Troubleshooting

### "Java not found" error
- Make sure JAVA_HOME is set correctly
- Restart your terminal after installing Java
- Try: `which java` to see if it's in PATH

### "ADB not found" error
- Verify ANDROID_HOME is set: `echo $ANDROID_HOME`
- Check if platform-tools exists: `ls $ANDROID_HOME/platform-tools`
- Make sure you've added platform-tools to PATH

### "No emulators found" error
- Create an emulator using Android Studio (see Step 3)
- Or start emulator manually before running `yarn android`
- Verify with: `emulator -list-avds`

### Build still fails

**Gradle Version Compatibility Issue:**
If you see `Unresolved reference: serviceOf` error, Gradle version is too new. React Native 0.72.6 requires:
- Gradle 8.0.2 (not 8.9+)
- Android Gradle Plugin 8.0.1

**Fix:**
```bash
# Edit android/gradle/wrapper/gradle-wrapper.properties
# Change distributionUrl to:
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0.2-bin.zip

# Edit android/build.gradle
# Set explicit AGP version:
classpath("com.android.tools.build:gradle:8.0.1")
```

**BuildConfig Error:**
If you see `defaultConfig contains custom BuildConfig fields, but the feature is disabled`:
- Enable BuildConfig globally for all subprojects in `android/build.gradle`:
  ```gradle
  subprojects {
      afterEvaluate { project ->
          if (project.hasProperty("android")) {
              android {
                  buildFeatures {
                      buildConfig = true
                  }
              }
          }
      }
  }
  ```
- Also enable in `android/app/build.gradle`:
  ```gradle
  buildFeatures {
      buildConfig = true
  }
  ```

**Other build issues:**
- Clean the build: `cd android && ./gradlew clean`
- Make sure Android SDK Platform 33 is installed in Android Studio
- Check that JDK 17 is being used: `java -version`

### M1/M2 Mac Issues
- Use **arm64-v8a** system images, not x86_64
- Make sure you're using ARM64 version of JDK
- Android Studio should auto-detect your architecture

## Quick Test Commands

```bash
# Test Java
java -version

# Test ADB
adb devices

# Test emulator
emulator -list-avds

# Test build (from project root)
cd android
./gradlew assembleDebug
```

## Next Steps After Setup

Once everything is working:
1. Start emulator manually or let `yarn android` start it
2. Run `yarn android` from project root
3. App should build and launch on emulator
4. Test location features
5. Test debug mode features

