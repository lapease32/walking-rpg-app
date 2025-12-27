# Walking RPG App

A location-based RPG mobile app that generates random creature encounters as you walk, making your daily walks more engaging and entertaining.

## Concept

This app:
- Tracks your location and distance traveled using GPS
- Generates random creature encounters based on distance traveled
- Provides RPG-style combat and interaction mechanics
- Encourages physical activity through gamification

## Architecture

Built with **TypeScript** and **React Native** for type safety and better developer experience.

### Core Components

1. **Location Tracking Service** (`src/services/LocationService.ts`)
   - Continuously tracks user's GPS position
   - Calculates distance traveled using Haversine formula
   - Monitors movement speed

2. **Encounter System** (`src/services/EncounterService.ts`)
   - Generates random encounters based on distance thresholds
   - Manages encounter probability and timing
   - Handles creature selection logic

3. **Data Models** (TypeScript classes)
   - `Creature` (`src/models/Creature.ts`): Defines creature types, stats, rarity, and properties
   - `Encounter` (`src/models/Encounter.ts`): Represents an active encounter with a creature
   - `Player` (`src/models/Player.ts`): Tracks player stats, level, experience, attack, defense, and inventory

4. **UI Components** (React Native with TypeScript)
   - `HomeScreen` (`src/screens/HomeScreen.tsx`): Main screen with location tracking and encounter handling
   - `EncounterModal` (`src/components/EncounterModal.tsx`): Modal for creature encounters
   - `PlayerStats` (`src/components/PlayerStats.tsx`): Displays player statistics
   - `DistanceDisplay` (`src/components/DistanceDisplay.tsx`): Shows distance traveled

## Documentation

📚 **All documentation has been organized into the [`docs/`](docs/) directory:**

- **[Setup Guides](docs/setup/)** - Installation and configuration instructions
- **[Troubleshooting](docs/troubleshooting/)** - Solutions to common issues
- **[Quick Start](docs/setup/QUICK_START.md)** - Get up and running quickly

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- TypeScript knowledge (project is fully typed)
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

For detailed setup instructions, see the [Setup Guide](docs/setup/SETUP.md).

## Project Structure

```
walking-rpg-app/
├── src/
│   ├── models/          # TypeScript data models
│   │   ├── Creature.ts
│   │   ├── Encounter.ts
│   │   └── Player.ts
│   ├── services/        # Core services
│   │   ├── LocationService.ts
│   │   └── EncounterService.ts
│   ├── components/      # Reusable UI components
│   │   ├── DistanceDisplay.tsx
│   │   ├── EncounterModal.tsx
│   │   └── PlayerStats.tsx
│   ├── screens/         # Screen components
│   │   └── HomeScreen.tsx
│   ├── utils/           # Utility functions
│   │   └── storage.ts
│   └── constants/       # App constants and configuration
│       └── config.ts
├── App.tsx              # Main app entry point (TypeScript)
├── tsconfig.json        # TypeScript configuration
└── package.json
```

## Features (Implemented)

- ✅ Location tracking with distance calculation (Haversine formula)
- ✅ Random encounter generation system based on distance traveled
- ✅ Creature data models with stats, rarity levels, and level scaling
- ✅ Combat system with turn-based fighting mechanics
- ✅ Player progression system (leveling, experience, stats)
- ✅ Player combat stats (attack, defense) that scale with level
- ✅ Creature defeat rewards with experience points
- ✅ Local data persistence using AsyncStorage
- ✅ Encounter modal with creature details and combat options
- ✅ Player stats display with combat stats

## Future Enhancements

- [ ] Creature collection/inventory system
- [ ] Different encounter types based on location/biome
- [ ] Creature catching mechanics (currently only defeat is implemented)
- [ ] Enhanced combat with creature attacks and special abilities
- [ ] Social features (friends, leaderboards)
- [ ] Daily challenges and quests
- [ ] Visual map with nearby encounters
- [ ] Item system and equipment
- [ ] Multiple creature types per encounter

## Permissions

This app requires the following permissions:
- **Location (Always)**: To track your movement and calculate distance
- **Location (When in Use)**: For basic location features

Location data is stored locally on your device and is not transmitted to external servers.

## License

MIT

