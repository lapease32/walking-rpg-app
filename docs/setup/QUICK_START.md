# Quick Start Guide

Get up and running with your Walking RPG app in minutes!

## Installation

```bash
# Install dependencies
npm install

# For iOS (macOS only)
cd ios && pod install && cd ..
```

## Configuration

### iOS Permissions

Add to `ios/WalkingRPG/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your walks.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your walks.</string>
```

### Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Run the App

```bash
# Start Metro
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Testing

### Test on Real Device (Recommended)
- Physical device provides best GPS accuracy
- Enables actual walking to trigger encounters

### Test on Simulator/Emulator
- **iOS**: Xcode Simulator → Features → Location
- **Android**: Emulator Extended Controls → Location

## Key Files to Customize

### Add More Creatures
Edit `src/models/Creature.ts`:
- Add to `CREATURE_TEMPLATES` array
- Define stats, rarity, description
- TypeScript types ensure type safety

### Adjust Encounter Rates
Edit `src/constants/config.ts`:
- `MIN_ENCOUNTER_DISTANCE`: Minimum meters before encounter
- `ENCOUNTER_CHANCE_PER_METER`: Probability per meter
- `MIN_TIME_BETWEEN_ENCOUNTERS`: Cooldown in milliseconds

### Modify Player Progression
Edit `src/models/Player.ts`:
- `getExperienceForNextLevel()`: Change leveling formula
- Adjust experience rewards in `Creature.getExperienceReward()`
- Modify combat stats scaling (`ATTACK_PER_LEVEL`, `DEFENSE_PER_LEVEL`)

## Common Tasks

### Force an Encounter (Testing)
In `src/screens/HomeScreen.tsx`, the `forceEncounter` function is already available in debug mode:
```typescript
const forceEncounter = (): void => {
  const location: Location = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      }
    : {
        latitude: 37.7749,
        longitude: -122.4194,
      };
  const encounter = EncounterService.forceEncounter(
    location,
    player?.level || 1
  );
  setCurrentEncounter(encounter);
  setShowEncounterModal(true);
};
```

### Change Distance Units
Edit `src/components/DistanceDisplay.tsx`:
```typescript
<DistanceDisplay distance={currentDistance} unit="mi" /> // miles
```

### Adjust GPS Accuracy
Edit `src/services/LocationService.ts`:
- `distanceFilter`: Lower = more updates (battery drain)
- `enableHighAccuracy`: False = better battery

## Next Features to Build

1. **Creature Collection** - Inventory/caught creatures list (combat system already implemented)
2. **Location Biomes** - Different creatures by area type
3. **Map View** - Visual map with location markers
4. **Daily Quests** - Goals and challenges
5. **Enhanced Combat** - Creature attacks and special abilities

## Troubleshooting

**Location not working?**
- Check permissions are granted
- Verify device location services are on
- Test with real device if possible

**Encounters not triggering?**
- Walk/simulate movement for 50+ meters
- Check encounter status: `EncounterService.getEncounterStatus()`
- Reduce `MIN_ENCOUNTER_DISTANCE` for testing

**Build errors?**
- Clear cache: `npm start -- --reset-cache`
- Reinstall: `rm -rf node_modules && npm install`
- iOS: `cd ios && pod install && cd ..`

## Need Help?

- Check `README.md` for overview
- See `ARCHITECTURE.md` for technical details
- Review `SETUP.md` for detailed setup instructions

