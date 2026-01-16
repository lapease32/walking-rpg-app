# Firebase Crashlytics Setup Guide

This guide explains how to set up Firebase Crashlytics for error reporting in the Walking RPG App.

## Overview

Firebase Crashlytics provides:
- **Automatic crash reporting** - Crashes are captured automatically
- **Non-fatal error tracking** - Track caught errors without crashing
- **User context** - Set user IDs and custom attributes for better debugging
- **Real-time alerts** - Get notified immediately when crashes occur
- **Breadcrumbs** - See what led to a crash with automatic log collection

## Prerequisites

1. A Firebase project (create one at https://console.firebase.google.com/)
2. Firebase App Distribution already configured (optional, but recommended)

## Installation Steps

### 1. Install Dependencies

The packages are already added to `package.json`. Run:

```bash
npm install
```

### 2. iOS Setup

#### a. Install CocoaPods dependencies

```bash
cd ios
pod install
cd ..
```

#### b. Add GoogleService-Info.plist

1. Download `GoogleService-Info.plist` from Firebase Console
   - Go to Project Settings → Your iOS app
   - Download the `GoogleService-Info.plist` file
2. Add it to your Xcode project:
   - Open `ios/WalkingRPGTemp.xcworkspace` in Xcode
   - Drag `GoogleService-Info.plist` into the project (make sure "Copy items if needed" is checked)
   - Ensure it's added to the target

#### c. Initialize Firebase in AppDelegate

The Firebase iOS SDK should auto-initialize, but verify in `ios/WalkingRPGTemp/AppDelegate.mm`:

```objc
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  // ... rest of your code
}
```

### 3. Android Setup

#### a. Add google-services.json

1. Download `google-services.json` from Firebase Console
   - Go to Project Settings → Your Android app
   - Download the `google-services.json` file
2. Place it in `android/app/google-services.json`

#### b. Update build.gradle files

The Firebase plugin should be automatically applied. Verify:

**android/build.gradle** (project-level):
```gradle
buildscript {
    dependencies {
        // Add the Google Services plugin
        classpath('com.google.gms:google-services:4.4.0')
    }
}
```

**android/app/build.gradle** (app-level):
```gradle
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services' // Add this at the bottom

// ... rest of your config
```

### 4. Verify Installation

#### Test Crash Reporting

Add this to your app temporarily (e.g., in HomeScreen):

```typescript
import ErrorReportingService from '../services/ErrorReportingService';

// Test button (only in dev)
{__DEV__ && (
  <Button 
    title="Test Crash" 
    onPress={() => ErrorReportingService.testCrash()} 
  />
)}
```

**Warning:** This will crash the app! Only use in development.

#### Check Firebase Console

1. Go to Firebase Console → Crashlytics
2. Trigger a test crash (or wait for a real crash)
3. You should see crash reports appear within a few minutes

## Usage

### Automatic Error Reporting

The app is configured to automatically report:
- **JavaScript exceptions** - Unhandled errors are captured automatically
- **Unhandled promise rejections** - Async errors are tracked
- **Global errors** - All fatal and non-fatal errors

### Manual Error Reporting

Use `ErrorReportingService` throughout your app:

```typescript
import ErrorReportingService from '../services/ErrorReportingService';

try {
  // Your code
} catch (error) {
  // Report non-fatal errors
  ErrorReportingService.recordNonFatalError(error as Error, {
    context: 'MyComponent',
    action: 'handleUserAction',
  });
}
```

### Set User Context

Identify users in crash reports:

```typescript
ErrorReportingService.setUserId('user-123');
ErrorReportingService.setAttribute('playerLevel', '5');
ErrorReportingService.setAttribute('deviceType', 'iOS');
```

### Log Messages (Breadcrumbs)

Add breadcrumbs that appear in crash reports:

```typescript
ErrorReportingService.log('User started encounter');
ErrorReportingService.log('Processing location update');
```

## Current Integration Points

The error reporting service is integrated in:

1. **index.ts** - Global error handlers for JS exceptions and promise rejections
2. **LocationService.ts** - Location tracking errors, GPS errors, permission issues
3. **Background notifications** - Error handling in notification event handlers

## Configuration

### Disable in Development (Optional)

Crashlytics is enabled by default. To disable in development:

```typescript
// In ErrorReportingService.ts
initialize(): void {
  crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
}
```

### Enable/Disable at Runtime

```typescript
// Disable error reporting (e.g., user privacy preference)
ErrorReportingService.setEnabled(false);

// Re-enable
ErrorReportingService.setEnabled(true);
```

## Viewing Crash Reports

1. **Firebase Console**
   - Navigate to Crashlytics in Firebase Console
   - View crash reports, affected users, and stack traces
   - Filter by version, OS, device, etc.

2. **Key Metrics**
   - Crash-free users percentage
   - Crash count per version
   - Affected devices and OS versions

## Best Practices

1. **Don't over-report** - Only report meaningful errors
2. **Add context** - Use `setAttribute()` to add useful debugging info
3. **Test regularly** - Verify Crashlytics is working in test builds
4. **Review reports** - Regularly check Firebase Console for new issues
5. **User privacy** - Don't log PII (personally identifiable information)

## Troubleshooting

### iOS: No crashes appearing

1. Verify `GoogleService-Info.plist` is in the project and added to target
2. Check that CocoaPods installed correctly: `cd ios && pod install`
3. Ensure Firebase is initialized in AppDelegate
4. Build a release version (Crashlytics works best in release builds)

### Android: No crashes appearing

1. Verify `google-services.json` is in `android/app/`
2. Check that Google Services plugin is applied in `build.gradle`
3. Ensure you're testing with a release build (not debug)
4. Check Android logs: `adb logcat | grep -i crashlytics`

### Errors not appearing in console

- Crashlytics may take a few minutes to process reports
- Ensure you have network connectivity
- Check that Crashlytics is enabled: `ErrorReportingService.setEnabled(true)`

## Additional Resources

- [Firebase Crashlytics Documentation](https://firebase.google.com/docs/crashlytics)
- [React Native Firebase Crashlytics](https://rnfirebase.io/crashlytics/usage)
- [Firebase Console](https://console.firebase.google.com/)

---

**Note:** Make sure to add `GoogleService-Info.plist` and `google-services.json` to your `.gitignore` if they contain sensitive information, or keep them private in your repo if they're safe to commit (they're generally safe as they're tied to your app's bundle ID).
