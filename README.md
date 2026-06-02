# StrideQuest

A walking RPG for iOS and Android. You level up a character by walking in the real world — GPS-tracked movement triggers turn-based creature encounters where you fight, earn procedurally generated loot, and equip gear to grow stronger.

> **Status:** in active development, approaching a first closed beta (TestFlight / Firebase App Distribution). "StrideQuest" is a working title.

## Features

- **Walk-to-play loop** — real-world distance (measured via GPS) accrues and triggers creature encounters; tracking continues in the background so walks aren't interrupted.
- **Archetype + ability combat** — three archetypes (Warrior, Rogue, Mage) with biased base stats, per-class resources (rage / energy / mana), and a small ability engine built on a few reusable primitives (direct damage, damage-over-time, buffs/debuffs, defensives).
- **Procedural loot & equipment** — affix-based item generation with rarities; equip gear across slots to shape your stats.
- **Progression** — levels, experience, and archetype- and gear-derived combat stats (attack, defense, HP, resistances, damage types).
- **Accounts & cloud save** — an anonymous account is created automatically; optional Sign in with Google / Apple links it so progress can be restored on reinstall or a new device. Saves are local-first and reconciled to Cloud Firestore.
- **Production tooling** — Firebase Crashlytics + Analytics, an in-app error boundary, and a build-time-gated debug panel (off in production).

## Tech stack

- **React Native 0.85** (New Architecture / Fabric + TurboModules) with **Hermes**
- **TypeScript**
- **Firebase** via `@react-native-firebase` — Authentication, Cloud Firestore, Crashlytics, Analytics
- Native location (`react-native-geolocation-service`), notifications (`notifee`)
- **Jest** (unit) + **Maestro** (E2E) with the Firebase Local Emulator Suite
- **GitHub Actions** CI: build, typecheck, lint, unit tests, E2E (iOS + Android), CodeQL

## Architecture

A single primary screen composes behavior from focused custom hooks, which sit on top of plain TypeScript models and singleton services. Persistence is **local-first** (AsyncStorage paints immediately) with a post-commit reconcile against Cloud Firestore. See [`docs/setup/ARCHITECTURE.md`](docs/setup/ARCHITECTURE.md) for detail.

```
HomeScreen
  └─ hooks/   useAuth · usePlayer · useEncounter · useLocation · useAppLifecycle
       └─ models/    Player · Archetype · Ability · Creature · Encounter · Item · DamageType
       └─ services/  Location · Encounter · Loot · Auth · CloudSync · Firebase · Analytics · Crashlytics · Notification
            └─ AsyncStorage (local-first)  +  Cloud Firestore (reconcile)
```

## Project structure

```
src/
├── models/        # Domain models: Player, Archetype, Ability, Creature, Encounter, Item(s), DamageType
├── services/      # Location, Encounter, Loot, Auth, CloudSync, Firebase, Analytics, Crashlytics, Notification
├── hooks/         # useAuth, usePlayer, useEncounter, useLocation, useAppLifecycle
├── components/    # Combat, encounter, inventory, equipment, archetype-select, settings, error boundary, …
├── screens/       # HomeScreen
├── constants/     # abilities, config, environment (build-time env gating)
├── utils/         # storage (local + cloud reconcile)
└── __tests__/     # Jest unit tests
e2e/maestro/       # Maestro E2E flows
docs/              # setup + architecture docs
```

## Getting started

### Prerequisites

- **Node.js 20+** (CI uses 22) and **Yarn**
- **iOS:** Xcode + CocoaPods (Ruby/Bundler)
- **Android:** Android Studio + JDK 17

### Firebase config (required to build)

The Firebase config files are intentionally **not committed**:

- `android/app/google-services.json`
- `ios/WalkingRPGTemp/GoogleService-Info.plist`

CI injects them from secrets; for a local build you supply your own from a Firebase project. Without them the native build will fail.

### Install & run

```bash
yarn install
cd ios && bundle exec pod install && cd ..   # iOS only

yarn start          # Metro
yarn ios            # build + run on iOS
yarn android        # build + run on Android
```

## Testing

```bash
yarn test           # Jest unit tests
yarn lint           # ESLint
yarn tsc --noEmit   # type check
```

End-to-end flows live in `e2e/maestro/` (Maestro) and run against the Firebase Local Emulator Suite in CI on both platforms.

## License

**Proprietary — All Rights Reserved.** The source is publicly viewable for portfolio and evaluation only; it may not be copied, modified, distributed, or used commercially without written permission. See [`LICENSE`](LICENSE).
