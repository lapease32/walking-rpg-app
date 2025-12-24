# Architecture Overview

This document explains the architecture and design decisions for the Walking RPG app.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Native App                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   HomeScreen │  │  Components  │  │   Services   │ │
│  │              │  │              │  │              │ │
│  │ - UI State   │  │ - Display    │  │ - Location   │ │
│  │ - Navigation │  │ - Modals     │  │ - Encounter  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│                   ┌────────┴────────┐                  │
│                   │   Data Models   │                  │
│                   │                 │                  │
│                   │ - Player        │                  │
│                   │ - Creature      │                  │
│                   │ - Encounter     │                  │
│                   └─────────────────┘                  │
│                            │                            │
│                   ┌────────┴────────┐                  │
│                   │   Local Storage │                  │
│                   │   (AsyncStorage)│                  │
│                   └─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
                            │
                            │
┌───────────────────────────┴───────────────────────────┐
│              Platform Services                         │
│                                                         │
│  ┌──────────────┐          ┌──────────────┐          │
│  │  Geolocation │          │  Permissions │          │
│  │     API      │          │     API      │          │
│  └──────────────┘          └──────────────┘          │
└───────────────────────────────────────────────────────┘
```

## Core Components

### 1. Location Service (`LocationService.js`)

**Purpose**: Handles all GPS-related functionality

**Key Features**:
- Continuous location tracking using `watchPosition`
- Distance calculation using Haversine formula
- Movement speed detection
- Distance filtering to avoid GPS jumps

**How It Works**:
1. Starts watching position with configurable accuracy
2. Calculates incremental distance between position updates
3. Filters out invalid GPS readings (> 1km jumps)
4. Calls callbacks for location and distance updates

**Configuration**:
- `distanceFilter`: Minimum 5 meters before update triggers
- `enableHighAccuracy`: True for precise tracking
- Filters GPS jumps > 1000m

### 2. Encounter Service (`EncounterService.js`)

**Purpose**: Manages random encounter generation

**Key Features**:
- Distance-based encounter triggering
- Probability calculation
- Time-based cooldowns
- Creature selection from templates

**How It Works**:
1. Tracks distance since last encounter
2. After minimum distance (50m), calculates encounter probability
3. Probability increases with distance traveled
4. Respects minimum time between encounters (30s)
5. Generates random creature from templates

**Encounter Algorithm**:
```
IF distance_since_last >= 50m AND time_since_last >= 30s:
    probability = min(1, (distance_since_last - 50) * 0.001)
    IF random() < probability:
        generate_encounter()
```

### 3. Data Models

#### Player (`Player.js`)
- Tracks level, experience, statistics
- Calculates experience needed for level ups
- Manages player progression
- Serializable for local storage

#### Creature (`Creature.js`)
- Defines creature properties (HP, attack, defense, speed)
- Rarity system (common to legendary)
- Level-based stat scaling
- Experience reward calculation

#### Encounter (`Encounter.js`)
- Represents an active encounter
- Links creature to location
- Manages encounter state (active, caught, defeated, fled)

### 4. Storage System (`storage.js`)

**Purpose**: Persist player data locally

**Features**:
- AsyncStorage for local persistence
- Player data serialization/deserialization
- Settings storage
- Data cleanup utilities

## Data Flow

### Starting a Walk

1. User taps "Start Walking"
2. `HomeScreen` calls `LocationService.startTracking()`
3. Location service requests GPS permissions
4. GPS starts providing position updates
5. Each update triggers distance calculation
6. Distance updates trigger encounter checks

### Encounter Generation

1. `LocationService` calculates distance increment
2. Calls `handleDistanceUpdate()` callback
3. `HomeScreen` forwards to `EncounterService.processDistanceUpdate()`
4. Service checks if encounter conditions are met
5. If conditions met, generates random encounter
6. Encounter passed to `HomeScreen` via callback
7. Modal displays encounter

### Encounter Resolution

1. User chooses action (Catch/Fight/Flee)
2. `HomeScreen` updates player state
3. Player data saved to AsyncStorage
4. Experience added, level-ups handled
5. Modal dismissed

## Design Decisions

### Why React Native?

- **Cross-platform**: Single codebase for iOS and Android
- **Mature ecosystem**: Well-supported location libraries
- **Performance**: Native modules for critical features
- **Rapid development**: Hot reload, excellent tooling

### Singleton Services

Location and Encounter services are singletons because:
- Only one instance needed globally
- Simplifies state management
- Easy to access from anywhere
- Prevents multiple GPS watchers

### Local-Only Storage

Currently uses AsyncStorage (local only) because:
- No backend required for MVP
- Faster development
- Works offline
- Privacy-friendly

Future: Can add cloud sync later

### Distance Calculation

Uses Haversine formula for:
- Accurate distance over Earth's surface
- Handles latitude/longitude properly
- Lightweight computation
- Standard for GPS applications

### Encounter Probability

Progressive probability system:
- Prevents encounters too frequently
- Rewards longer walks
- Feels more natural than fixed intervals
- Configurable difficulty

## Performance Considerations

1. **GPS Updates**: Filtered to 5m minimum (reduces battery drain)
2. **State Updates**: Batched where possible
3. **Storage**: Async to avoid blocking UI
4. **Memory**: Models are lightweight, minimal state

## Security & Privacy

- Location data stored locally only
- No data transmitted externally
- User controls location permissions
- Can be extended with privacy controls

## Extension Points

### Easy to Add

1. **More Creatures**: Add to `CREATURE_TEMPLATES` array
2. **Biome System**: Filter creatures by location type
3. **Combat System**: Extend `Encounter` class
4. **Items/Inventory**: Extend `Player.inventory`
5. **Quests**: New service similar to `EncounterService`

### Requires More Work

1. **Backend Integration**: Replace AsyncStorage with API calls
2. **Multiplayer**: Real-time location sharing
3. **Map View**: Integrate map library (e.g., react-native-maps)
4. **AR Features**: Camera integration for AR encounters

## Testing Strategy

### Unit Tests (Future)

- Model logic (Player leveling, Creature stats)
- Service calculations (distance, probability)
- Storage serialization

### Integration Tests (Future)

- Location → Distance → Encounter flow
- Player state persistence
- Encounter resolution

### Manual Testing

- Real device GPS tracking
- Encounter triggering at various distances
- Level progression
- Data persistence across app restarts

