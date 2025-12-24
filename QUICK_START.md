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
Edit `src/models/Creature.js`:
- Add to `CREATURE_TEMPLATES` array
- Define stats, rarity, description

### Adjust Encounter Rates
Edit `src/constants/config.js`:
- `MIN_ENCOUNTER_DISTANCE`: Minimum meters before encounter
- `ENCOUNTER_CHANCE_PER_METER`: Probability per meter
- `MIN_TIME_BETWEEN_ENCOUNTERS`: Cooldown in milliseconds

### Modify Player Progression
Edit `src/models/Player.js`:
- `getExperienceForNextLevel()`: Change leveling formula
- Adjust experience rewards in `Creature.getExperienceReward()`

## Common Tasks

### Force an Encounter (Testing)
In `HomeScreen.js`, add:
```javascript
const testEncounter = () => {
  const location = LocationService.getCurrentLocationCached();
  const encounter = EncounterService.forceEncounter(location, player.level);
  setCurrentEncounter(encounter);
  setShowEncounterModal(true);
};
```

### Change Distance Units
Edit `src/components/DistanceDisplay.js`:
```javascript
<DistanceDisplay distance={currentDistance} unit="mi" /> // miles
```

### Adjust GPS Accuracy
Edit `src/services/LocationService.js`:
- `distanceFilter`: Lower = more updates (battery drain)
- `enableHighAccuracy`: False = better battery

## Next Features to Build

1. **Combat System** - Turn-based battles
2. **Creature Collection** - Inventory/caught creatures list
3. **Location Biomes** - Different creatures by area type
4. **Map View** - Visual map with location markers
5. **Daily Quests** - Goals and challenges

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

