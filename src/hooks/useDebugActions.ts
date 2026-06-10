import { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { Player } from '../models/Player';
import { Rarity } from '../models/Creature';
import { LocationData, DistanceData } from '../services/LocationService';
import CrashlyticsService from '../services/CrashlyticsService';

export interface DebugReadouts {
  encounterChance: number;
  lastEncounterChance: number | null;
  isTimeBlocking: boolean;
  timeRemaining: number;
  /** Latest GPS fix (state, not ref) so the panel re-renders as it updates. */
  location: LocationData | null;
}

export interface DebugSettings {
  bypassTimeConstraint: boolean;
  setBypassTimeConstraint: (value: boolean) => void;
  forceItemDrop: boolean;
  setForceItemDrop: (value: boolean) => void;
  /** null = roll rarity normally; otherwise force every drop to this rarity. */
  forcedRarity: Rarity | null;
  setForcedRarity: (value: Rarity | null) => void;
}

export interface DebugActions {
  simulateLocationUpdate: () => void;
  simulateMovement: () => void;
  forceEncounter: () => void;
  forceLevelUp: () => void;
  addXP: (amount: number) => void;
  resetLevel: () => void;
  testCrash: () => void;
  restoreHp: () => void;
  /** Show the reward reveal for a synthetic drop at `rarity` (null = random); no combat. */
  previewReveal: (rarity: Rarity | null) => void;
}

/** Everything DebugPanel needs, grouped so the panel can stay presentational. */
export interface DebugController {
  readouts: DebugReadouts;
  settings: DebugSettings;
  actions: DebugActions;
}

interface UseDebugActionsParams {
  // Player domain (usePlayer)
  playerRef: MutableRefObject<Player | null>;
  setPlayerAndSave: (player: Player) => void;
  // Location domain (useLocation + HomeScreen.handleDistanceUpdate)
  currentDistance: number;
  currentLocation: LocationData | null;
  currentLocationRef: MutableRefObject<LocationData | null>;
  handleDistanceUpdate: (data: DistanceData) => Promise<void>;
  // Encounter-domain debug surface (owned by useEncounter, re-grouped here for the panel)
  encounterChance: number;
  lastEncounterChance: number | null;
  isTimeBlocking: boolean;
  timeRemaining: number;
  bypassTimeConstraint: boolean;
  setBypassTimeConstraint: (value: boolean) => void;
  forceItemDrop: boolean;
  setForceItemDrop: (value: boolean) => void;
  forcedRarity: Rarity | null;
  setForcedRarity: (value: Rarity | null) => void;
  forceEncounter: () => void;
  debugPreviewReveal: (rarity: Rarity | null) => void;
}

/**
 * Owns the debug-mode action logic — player mutation (force level/XP/reset), location
 * simulation, and the Crashlytics test — and re-groups the encounter-domain debug config that
 * useEncounter exposes. This keeps DebugPanel purely presentational and collapses its prop
 * surface, matching the post-refactor split (hooks own logic, components render). Debug
 * concerns stay OUT of the production hooks. Debug-only: the panel that consumes this is hard-
 * gated by ENV_CONFIG.enableDebugMode, so none of these actions are reachable in a prod build.
 *
 * Handlers are plain closures recreated each render (as they were when inlined in DebugPanel) —
 * cheap and behavior-identical; the panel isn't memoized.
 */
export function useDebugActions(params: UseDebugActionsParams): DebugController {
  const {
    playerRef,
    setPlayerAndSave,
    currentDistance,
    currentLocation,
    currentLocationRef,
    handleDistanceUpdate,
    encounterChance,
    lastEncounterChance,
    isTimeBlocking,
    timeRemaining,
    bypassTimeConstraint,
    setBypassTimeConstraint,
    forceItemDrop,
    setForceItemDrop,
    forcedRarity,
    setForcedRarity,
    forceEncounter,
    debugPreviewReveal,
  } = params;

  const simulateMovement = (): void => {
    const fakeDistance = 100;
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;
    const latOffset = fakeDistance / 111000;
    const newLocation: LocationData = {
      latitude: baseLat + latOffset,
      longitude: baseLon,
      accuracy: 10,
      altitude: 0,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
    handleDistanceUpdate({
      incremental: fakeDistance,
      total: currentDistance + fakeDistance,
      location: newLocation,
    });
  };

  const simulateLocationUpdate = (): void => {
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;
    // Fixed offsets (~7m NE) — direction doesn't matter for debug purposes
    const newLocation: LocationData = {
      latitude: baseLat + 0.00005,
      longitude: baseLon + 0.00005,
      accuracy: 10,
      altitude: 0,
      heading: 45,
      speed: 1.5,
      timestamp: Date.now(),
    };
    handleDistanceUpdate({
      incremental: 10,
      total: currentDistance + 10,
      location: newLocation,
    });
  };

  const forceLevelUp = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.forceLevelUp();
    setPlayerAndSave(updatedPlayer);
    Alert.alert('Level Up!', `You are now level ${updatedPlayer.level}!`);
  };

  const addXP = (amount: number): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    const levelsGained = updatedPlayer.addExperience(amount);
    setPlayerAndSave(updatedPlayer);
    if (levelsGained > 0) {
      Alert.alert(
        'XP Added & Level Up!',
        `Added ${amount} XP!\nGained ${levelsGained} level(s)!\nYou are now level ${updatedPlayer.level}!`,
      );
    } else {
      Alert.alert(
        'XP Added',
        `Added ${amount} XP!\nCurrent XP: ${updatedPlayer.experience}/${updatedPlayer.getExperienceForNextLevel()}`,
      );
    }
  };

  const resetLevel = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    Alert.alert(
      'Reset Level',
      'Are you sure you want to reset to level 1? This will reset your level, XP, and combat stats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const currentPlayerAtConfirm = playerRef.current;
            if (!currentPlayerAtConfirm) return;
            const updatedPlayer = new Player(currentPlayerAtConfirm.toJSON());
            updatedPlayer.resetLevel();
            setPlayerAndSave(updatedPlayer);
            Alert.alert('Level Reset', 'You have been reset to level 1.');
          },
        },
      ],
    );
  };

  const restoreHp = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.fullHeal();
    setPlayerAndSave(updatedPlayer);
  };

  const testCrash = (): void => {
    Alert.alert(
      '⚠️ Test Crash',
      'This will crash the app immediately to test Crashlytics reporting. The crash report will appear in Firebase Console within a few minutes.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!CrashlyticsService.isInitialized()) {
                await CrashlyticsService.initialize();
              }
              await CrashlyticsService.setCollectionEnabled(true);
              CrashlyticsService.setAttribute('test_crash', 'true');
              CrashlyticsService.setAttribute('player_level', playerRef.current?.level ?? 0);
              CrashlyticsService.log('User initiated test crash from debug menu');
              await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
              await CrashlyticsService.crash();
            } catch (error) {
              Alert.alert(
                'Error',
                `Failed to prepare crash test: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          },
        },
      ],
    );
  };

  return {
    readouts: {
      encounterChance,
      lastEncounterChance,
      isTimeBlocking,
      timeRemaining,
      location: currentLocation,
    },
    settings: {
      bypassTimeConstraint,
      setBypassTimeConstraint,
      forceItemDrop,
      setForceItemDrop,
      forcedRarity,
      setForcedRarity,
    },
    actions: {
      simulateLocationUpdate,
      simulateMovement,
      forceEncounter,
      forceLevelUp,
      addXP,
      resetLevel,
      testCrash,
      restoreHp,
      previewReveal: debugPreviewReveal,
    },
  };
}
