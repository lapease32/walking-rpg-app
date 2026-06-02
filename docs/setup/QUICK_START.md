# Quick Start

The fast path. For detail see [SETUP.md](SETUP.md); for design see [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Firebase config (required)

Add your Firebase config files (both are gitignored — the native build needs them):

- `android/app/google-services.json`
- `ios/WalkingRPGTemp/GoogleService-Info.plist`

## 2. Install & run

```bash
yarn install
cd ios && bundle exec pod install && cd ..   # iOS only

yarn start            # Metro
yarn ios              # or: yarn android
```

(iOS can also be run from `ios/WalkingRPGTemp.xcworkspace` in Xcode.)

## 3. Test the walk loop

Encounters trigger from GPS distance, so simulate movement to test indoors:

- **iOS Simulator:** Features → Location
- **Android Emulator:** Extended Controls (•••) → Location

…or walk outdoors on a real device (most representative).

## Tuning gameplay

Gameplay constants live in `src/constants/config.ts` (encounter/distance/combat tuning) and `src/constants/abilities.ts` (per-archetype ability rosters). Archetype base stats are in `src/models/Archetype.ts`.

---

See also: [SETUP.md](SETUP.md) (detailed) · [ANDROID_SETUP.md](ANDROID_SETUP.md) (Android specifics) · [ARCHITECTURE.md](ARCHITECTURE.md) (design).
