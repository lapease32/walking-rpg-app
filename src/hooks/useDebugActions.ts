import { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { Player } from '../models/Player';
import { Rarity } from '../models/Creature';
import CloudSyncService, { CloudSyncStatus } from '../services/CloudSyncService';
import { generateItem } from '../services/LootService';
import { LocationData, DistanceData } from '../services/LocationService';

export interface DebugReadouts {
  encounterChance: number;
  lastEncounterChance: number | null;
  isTimeBlocking: boolean;
  timeRemaining: number;
  /** Latest GPS fix (state, not ref) so the panel re-renders as it updates. */
  location: LocationData | null;
  /** Cloud-write health (last successful sync, pending writes) — read each render. */
  syncStatus: CloudSyncStatus;
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
  /** Add `distanceMeters` of simulated movement (the panel offers +10 / +100 / +1000). */
  simulateMovement: (distanceMeters: number) => void;
  forceEncounter: () => void;
  /** Jump to an exact level with the canonical stats for it (panel offers L1/5/10/20/50). */
  setLevel: (targetLevel: number) => void;
  addXP: (amount: number) => void;
  restoreHp: () => void;
  /** Empty the inventory (equipped items kept) — for testing repeated drops without filling up. */
  clearInventory: () => void;
  /** Jam every empty inventory slot with a generated item — tests the inventory-full path. */
  fillInventory: () => void;
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
 * Owns the debug-mode action logic — player mutation (set level, add XP, heal, fill/clear
 * inventory) and location simulation — and re-groups the encounter-domain debug config that
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

  const simulateMovement = (distanceMeters: number): void => {
    const baseLat = currentLocationRef.current?.latitude || 37.7749;
    const baseLon = currentLocationRef.current?.longitude || -122.4194;
    const latOffset = distanceMeters / 111000;
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
      incremental: distanceMeters,
      total: currentDistance + distanceMeters,
      location: newLocation,
    });
  };

  const setLevel = (targetLevel: number): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.setLevel(targetLevel);
    setPlayerAndSave(updatedPlayer);
    Alert.alert('Level Set', `You are now level ${updatedPlayer.level}.`);
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

  const fillInventory = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    // Fill every empty slot with a generated item (at the player's level); addItemToInventory
    // returns -1 once full. Exercises the "inventory full → drop lost" path.
    let added = 0;
    while (updatedPlayer.addItemToInventory(generateItem(updatedPlayer.level)) !== -1) {
      added += 1;
    }
    setPlayerAndSave(updatedPlayer);
    Alert.alert('Inventory Filled', `Added ${added} item(s); inventory is now full.`);
  };

  const restoreHp = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.fullHeal();
    setPlayerAndSave(updatedPlayer);
  };

  const clearInventory = (): void => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;
    const updatedPlayer = new Player(currentPlayer.toJSON());
    updatedPlayer.clearInventory();
    setPlayerAndSave(updatedPlayer);
  };

  return {
    readouts: {
      encounterChance,
      lastEncounterChance,
      isTimeBlocking,
      timeRemaining,
      location: currentLocation,
      syncStatus: CloudSyncService.getSyncStatus(),
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
      simulateMovement,
      forceEncounter,
      setLevel,
      addXP,
      restoreHp,
      clearInventory,
      fillInventory,
      previewReveal: debugPreviewReveal,
    },
  };
}
