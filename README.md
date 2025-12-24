# Walking RPG App

A location-based RPG mobile app that generates random creature encounters as you walk, making your daily walks more engaging and entertaining.

## Concept

Similar to Pokémon GO, this app:
- Tracks your location and distance traveled using GPS
- Generates random creature encounters based on distance traveled
- Provides RPG-style combat and interaction mechanics
- Encourages physical activity through gamification

## Architecture

### Core Components

1. **Location Tracking Service** (`src/services/LocationService.js`)
   - Continuously tracks user's GPS position
   - Calculates distance traveled
   - Monitors movement speed

2. **Encounter System** (`src/services/EncounterService.js`)
   - Generates random encounters based on distance thresholds
   - Manages encounter probability and timing
   - Handles creature selection logic

3. **Data Models**
   - `Creature`: Defines creature types, stats, and properties
   - `Encounter`: Represents an active encounter with a creature
   - `Player`: Tracks player stats, level, inventory

4. **UI Components**
   - Map view showing current location
   - Encounter screen for creature interactions
   - Stats/profile screen
   - Main navigation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- React Native development environment
- iOS: Xcode (for iOS simulator/device)
- Android: Android Studio (for Android emulator/device)

### Installation

```bash
npm install
```

### Running the App

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
walking-rpg-app/
├── src/
│   ├── models/          # Data models (Creature, Player, Encounter)
│   ├── services/        # Core services (Location, Encounter)
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── utils/           # Utility functions
│   └── constants/       # App constants and configuration
├── App.js               # Main app entry point
└── package.json
```

## Features (Current Foundation)

- ✅ Location tracking with distance calculation
- ✅ Random encounter generation system
- ✅ Creature data models with stats
- ✅ Basic encounter triggering logic
- ✅ Player progress tracking

## Future Enhancements

- [ ] Combat system for encounters
- [ ] Creature collection/inventory
- [ ] Leveling and progression system
- [ ] Different encounter types based on location/biome
- [ ] Offline mode with local storage
- [ ] Social features (friends, leaderboards)
- [ ] Daily challenges and quests
- [ ] Visual map with nearby encounters

## Permissions

This app requires the following permissions:
- **Location (Always)**: To track your movement and calculate distance
- **Location (When in Use)**: For basic location features

Location data is stored locally on your device and is not transmitted to external servers.

## License

MIT

