# ProGuard Setup and Testing Guide

## What Was Changed

1. **Enabled ProGuard** in `android/app/build.gradle`
   - Changed `enableProguardInReleaseBuilds` from `false` to `true`

2. **Added Comprehensive ProGuard Rules** in `android/app/proguard-rules.pro`
   - React Native core classes
   - AsyncStorage
   - Geolocation
   - React Native Permissions
   - Hermes (JavaScript engine)
   - Native modules and packages
   - Main application classes

## Potential Issues and Solutions

### Issue 1: App Crashes on Startup
**Symptoms:** App crashes immediately after launch, or shows blank screen

**Possible Causes:**
- ProGuard removed a class that's needed at runtime
- Missing keep rule for a native module

**Solution:**
1. Check logcat for ProGuard-related errors:
   ```bash
   adb logcat | grep -i "proguard\|classnotfound\|nosuchmethod"
   ```
2. Look for errors like: `ClassNotFoundException` or `NoSuchMethodError`
3. Add keep rules for the missing class in `proguard-rules.pro`

### Issue 2: Native Modules Not Working
**Symptoms:** Features like AsyncStorage, Geolocation, or Permissions don't work

**Solution:**
- The rules I added should cover these, but if issues persist:
  ```proguard
  # Add specific keep rule for the problematic module
  -keep class com.reactnativecommunity.asyncstorage.** { *; }
  ```

### Issue 3: Build Fails
**Symptoms:** Gradle build fails with ProGuard errors

**Solution:**
1. Check the build output for specific ProGuard warnings
2. Add `-dontwarn` rules for libraries that have warnings but work fine:
   ```proguard
   -dontwarn com.some.library.**
   ```

### Issue 4: App Works But Some Features Broken
**Symptoms:** App runs but specific features don't work

**Solution:**
1. Test each feature individually
2. Check logcat for runtime errors
3. Add keep rules for the specific classes involved

## Testing ProGuard Build

### Step 1: Clean Build
```bash
cd android
./gradlew clean
```

### Step 2: Build Release APK
```bash
./gradlew assembleRelease
```

### Step 3: Install and Test
```bash
# Install on connected device
adb install app/build/outputs/apk/release/app-release.apk

# Or install manually on device
```

### Step 4: Test All Features
Test these features to ensure ProGuard didn't break anything:

- [ ] App launches successfully
- [ ] Location tracking works
- [ ] Location permissions are requested correctly
- [ ] Player data saves/loads (AsyncStorage)
- [ ] Encounters trigger correctly
- [ ] Combat system works
- [ ] Inventory system works
- [ ] All modals open/close correctly

### Step 5: Monitor Logs
While testing, monitor for errors:
```bash
# Watch logcat in real-time
adb logcat | grep -E "ERROR|FATAL|Exception"
```

## Verifying ProGuard is Working

### Check APK Size
ProGuard should reduce your APK size:
```bash
# Before ProGuard (debug build)
ls -lh android/app/build/outputs/apk/debug/app-debug.apk

# After ProGuard (release build)
ls -lh android/app/build/outputs/apk/release/app-release.apk
```

The release APK should be smaller than the debug APK.

### Check Obfuscation
You can verify code is obfuscated by:
1. Decompiling the APK (using tools like `jadx` or `apktool`)
2. Checking that class names are obfuscated (e.g., `a`, `b`, `c` instead of meaningful names)

**Note:** Don't share obfuscated code publicly - this is just for verification.

## If Something Breaks

### Quick Fix: Disable ProGuard Temporarily
If you need to quickly disable ProGuard to test:
```gradle
def enableProguardInReleaseBuilds = false
```

Then rebuild:
```bash
./gradlew clean assembleRelease
```

### Add Missing Keep Rules
If a specific class is missing, add to `proguard-rules.pro`:
```proguard
# Example: If MyCustomModule breaks
-keep class com.walkingrpgtemp.MyCustomModule { *; }
-keepclassmembers class com.walkingrpgtemp.MyCustomModule { *; }
```

### Common Patterns

**For a specific package:**
```proguard
-keep class com.example.package.** { *; }
```

**For classes with specific annotations:**
```proguard
-keep @com.facebook.react.bridge.ReactMethod class * { *; }
```

**For classes implementing an interface:**
```proguard
-keep class * implements com.example.Interface { *; }
```

## ProGuard Rules Explained

The rules I added follow this pattern:

1. **React Native Core** - Keeps all React Native classes that are needed
2. **Native Modules** - Keeps classes that bridge JavaScript and native code
3. **Your Dependencies** - Keeps AsyncStorage, Geolocation, Permissions
4. **Main Classes** - Keeps your MainApplication and MainActivity
5. **General Rules** - Keeps Parcelable, Serializable, enums, annotations

## Best Practices

1. **Test thoroughly** after enabling ProGuard
2. **Keep rules minimal** - only keep what's necessary
3. **Monitor crash reports** - if using crash reporting, watch for ProGuard-related crashes
4. **Update rules** when adding new native modules
5. **Document custom rules** - if you add project-specific rules, document why

## Rollback Plan

If ProGuard causes too many issues, you can:

1. **Disable it:**
   ```gradle
   def enableProguardInReleaseBuilds = false
   ```

2. **Use less aggressive obfuscation:**
   - Keep `minifyEnabled true` but adjust ProGuard rules
   - Or use R8 (newer, less aggressive by default)

## Next Steps

1. ✅ ProGuard is now enabled
2. ⏭️ **Test the release build** (see "Testing ProGuard Build" above)
3. ⏭️ If issues occur, add specific keep rules
4. ⏭️ Once working, proceed with distribution setup

## Additional Resources

- [React Native ProGuard Documentation](https://reactnative.dev/docs/signed-apk-android#enabling-proguard-to-reduce-the-size-of-the-apk)
- [ProGuard Manual](https://www.guardsquare.com/manual/configuration/usage)
- [Android Code Shrinking](https://developer.android.com/studio/build/shrink-code)
