# Architecture Overview

How StrideQuest is structured and the key design decisions behind it.

## High-level shape

A single primary screen (`HomeScreen`) owns very little logic itself — it composes behavior from focused **custom hooks**, which operate on plain **TypeScript models** and singleton **services**. State lives in the hooks (via refs/state), not a global store; for a single-screen game loop that's simpler than Zustand/Redux.

```
┌──────────────────────────────────────────────────────────────┐
│  HomeScreen (composition + layout)                            │
│                                                              │
│  hooks/                                                      │
│   useAuth · usePlayer · useEncounter · useLocation ·         │
│   useAppLifecycle                                           │
│        │                                                    │
│        ▼                                                    │
│  models/ (plain TS)        services/ (singletons)           │
│   Player, Archetype,        Location, Encounter, Loot,      │
│   Ability, Creature,        Auth, CloudSync, Firebase,      │
│   Encounter, Item(s),       Analytics, Crashlytics,         │
│   DamageType                Notification                    │
└──────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
  AsyncStorage (local-first)        Cloud Firestore (reconcile)
        │                                   │
        └──────────── Firebase (Auth · Firestore · Crashlytics · Analytics)
                       Native: Geolocation · Notifications
```

Runs on the React Native **New Architecture** (Fabric + TurboModules) with **Hermes** on both platforms.

## Layers

### Hooks (`src/hooks/`)
The HomeScreen logic is split into single-responsibility hooks:
- **`useAuth`** — Firebase auth lifecycle (anonymous on first launch; link to Google/Apple); exposes the current user and sign-in/out.
- **`usePlayer`** — loads/holds the `Player`, applies progression, and owns persistence. Paints from local storage first, then reconciles with the cloud (see *Persistence*).
- **`useEncounter`** — encounter/combat orchestration: generating encounters, running turn-based combat, applying ability/resource/resistance rules, awarding loot/XP.
- **`useLocation`** — GPS tracking and distance accrual.
- **`useAppLifecycle`** — foreground/background transitions and related housekeeping.

### Models (`src/models/`)
Plain TypeScript, no framework coupling, unit-tested:
- **`Player`** — stats, level/XP, equipment, inventory, archetype, derived combat stats.
- **`Archetype`** — enum (`martial`/`agile`/`mage`, stable IDs persisted in saves) + `ARCHETYPE_CONFIGS` (display name, resource, biased base stats per level). Display names: Warrior / Rogue / Mage.
- **`Ability`** / `constants/abilities.ts` — abilities are data over a small set of primitives (direct damage, damage-over-time, buff/debuff, defensive) resolved by a shared `resolveAbility`.
- **`Creature`**, **`Encounter`** — enemy templates/state and an active encounter.
- **`Item`** / `items.ts`, **`DamageType`** — affix-based items, equipment slots, damage types + resistances.

### Services (`src/services/`)
Singletons (one GPS watcher, one Firebase connection, etc.):
- **`LocationService`** — `watchPosition`, Haversine distance, GPS-jump filtering, and **adaptive accuracy**: drops to low-power network location when stationary and back to high-accuracy GPS when moving, cutting battery draw.
- **`EncounterService`** — distance/probability/cooldown logic for spawning encounters.
- **`LootService`** — procedural affix-based item generation.
- **`AuthService`** — anonymous + Google + Apple sign-in; account linking.
- **`CloudSyncService`** / **`FirebaseService`** — Firestore read/write of player data; Firebase init.
- **`AnalyticsService`**, **`CrashlyticsService`**, **`NotificationService`** — Firebase Analytics/Crashlytics and local notifications.

## Persistence — local-first with cloud reconcile

The first paint **never blocks on the network**. `usePlayer` reads a local snapshot from AsyncStorage and renders immediately; a *post-commit* `useEffect` then reconciles against Cloud Firestore (re-reading the current local timestamp after the cloud fetch so progress earned during the read isn't clobbered). This avoids a class of cold-start stalls where a synchronous native Firestore read on the JS thread froze the first frame. Net result: instant local paint, eventual cloud consistency, and a reinstall flow that recovers cloud progress before creating a new character.

## Build-time environment gating

`constants/environment.ts` derives the environment from a build-time `APP_ENV` (inlined by Babel). It **fails safe to production** (debug panel OFF) when `APP_ENV` is unset, so production builds can't ship debug controls. E2E builds opt in with `APP_ENV=testing`.

## Testing

- **Unit (Jest)** — models and service logic (progression, ability resolution, loot generation, storage serialization, distance/probability math).
- **End-to-end (Maestro)** — a golden-path flow (launch → archetype select → force encounter → combat → loot) runs on **both iOS and Android** in CI against the **Firebase Local Emulator Suite**, with network isolation so tests never touch production.
- **CI** — GitHub Actions runs build, typecheck, lint, unit tests, E2E (both platforms), CodeQL, and dependency review on every PR.

## Key design decisions

- **Custom hooks over a global store** — the game is effectively one screen; hooks that own their own refs are simpler than Zustand/Redux here. New features are written as hooks from day one.
- **Data-driven abilities** — abilities are configuration over a few primitives rather than bespoke code per ability, so new abilities are mostly data.
- **Stable archetype IDs, fluid display names** — enum values (`martial`/`agile`/`mage`) are persisted in saves and used as E2E testIDs, so they never change; only display names do.
- **Singletons for hardware/connection-bound services** — one GPS watcher and one Firebase connection avoid duplicate watchers and races.
- **Local-first** — responsiveness and offline play first; the cloud is a backup/sync layer, not the source of truth for the first frame.
