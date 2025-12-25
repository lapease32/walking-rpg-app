# Setup Guide

This guide will help you set up and run the Walking RPG app on your development machine.

## Prerequisites

1. **Node.js** (v16 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

3. **For iOS Development:**
   - macOS (required)
   - Xcode (from Mac App Store)
   - CocoaPods: `sudo gem install cocoapods`

4. **For Android Development:**
   - Android Studio
   - Android SDK
   - Java Development Kit (JDK)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. iOS Setup (macOS only)

```bash
cd ios
pod install
cd ..
```

### 3. Configure Permissions

#### iOS (Info.plist)

Add location permissions to `ios/WalkingRPG/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your walks and generate encounters.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your walks and generate encounters.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs location access to track your walks and generate encounters.</string>
```

#### Android (AndroidManifest.xml)

Add location permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Running the App

### Start Metro Bundler

```bash
npm start
```

### Run on iOS

```bash
npm run ios
```

Or open `ios/WalkingRPG.xcworkspace` in Xcode and run from there.

### Run on Android

```bash
npm run android
```

Make sure you have an Android emulator running or a device connected.

## Testing Location Features

Since location tracking requires actual GPS data:

1. **Physical Device**: Test on a real device for best results
2. **Simulator/Emulator**: 
   - iOS: Use Xcode's location simulator
   - Android: Use Android Studio's location emulator

### iOS Simulator Location

In Xcode Simulator: Features → Location → Choose a location or custom location

### Android Emulator Location

In Android Studio Emulator: Use the Extended Controls (three dots) → Location tab

## Project Structure

```
walking-rpg-app/
├── src/
│   ├── models/          # Data models
│   │   ├── Creature.js
│   │   ├── Encounter.js
│   │   └── Player.js
│   ├── services/        # Core services
│   │   ├── LocationService.js
│   │   └── EncounterService.js
│   ├── components/      # UI components
│   │   ├── DistanceDisplay.js
│   │   ├── EncounterModal.js
│   │   └── PlayerStats.js
│   ├── screens/         # Screen components
│   │   └── HomeScreen.js
│   ├── utils/           # Utilities
│   │   └── storage.js
│   └── constants/       # Configuration
│       └── config.js
├── App.js               # Main entry point
└── package.json
```

## Key Features Implemented

- ✅ GPS location tracking
- ✅ Distance calculation using Haversine formula
- ✅ Random encounter generation based on distance
- ✅ Player progression system (level, XP)
- ✅ Creature models with stats and rarity
- ✅ Local data persistence
- ✅ Basic UI with encounter modals

## Next Steps

1. **Implement Combat System**: Add turn-based combat mechanics
2. **Creature Collection**: Build an inventory/collection system
3. **Location-based Encounters**: Different creatures based on real-world location
4. **Visual Map**: Add map view showing nearby encounters
5. **Biome System**: Different encounter rates/types based on location type
6. **Offline Mode**: Ensure encounters work without internet
7. **Backend Integration**: Optional cloud sync for multi-device support

## Troubleshooting

### Location Not Working

- Ensure permissions are properly configured
- Check that location services are enabled on device
- For iOS: Make sure Info.plist has correct keys
- For Android: Verify AndroidManifest.xml permissions

### Encounters Not Triggering

- Make sure you're moving (simulated location updates help in emulator)
- Check that minimum distance threshold is met
- Verify encounter service is properly initialized

### Build Issues

- Clear cache: `npm start -- --reset-cache`
- Clean build folders and reinstall dependencies
- For iOS: `cd ios && pod install && cd ..`
- For Android: Clean build in Android Studio

## Development Tips

- Use React Native Debugger for debugging
- Enable remote debugging in development menu
- Test location features on real devices for accuracy
- Adjust encounter rates in `src/constants/config.js`

