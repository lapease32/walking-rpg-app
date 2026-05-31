import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerData } from '../models/Player';
import { CreatureConstructorParams } from '../models/Creature';
import { Location, EncounterStatus, ENCOUNTER_STATUSES } from '../models/Encounter';
import CloudSyncService from '../services/CloudSyncService';

/**
 * Storage utilities for persisting player data
 */
const STORAGE_KEYS = {
  PLAYER_DATA: '@walking_rpg:player_data',
  PLAYER_SAVED_AT: '@walking_rpg:player_saved_at',
  SETTINGS: '@walking_rpg:settings',
  PENDING_ENCOUNTER: '@walking_rpg:pending_encounter',
  TRACKING_STATE: '@walking_rpg:tracking_state',
  CONFLICT_PENDING: '@walking_rpg:conflict_pending',
} as const;

export interface PendingConflictRecord {
  localData: PlayerData | null;
  localSavedAt: number;
  cloudData: PlayerData | null;
  cloudSavedAt: number;
}

export interface AppSettings {
  [key: string]: any;
}

/**
 * Serialized encounter data for storage
 */
export interface EncounterData {
  creature: CreatureConstructorParams;
  location: Location;
  timestamp: number;
  playerLevel: number;
  status: EncounterStatus;
}

export async function savePlayerData(player: { toJSON(): PlayerData }): Promise<boolean> {
  try {
    const playerData = player.toJSON();
    const savedAt = Date.now();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.PLAYER_DATA, JSON.stringify(playerData)],
      [STORAGE_KEYS.PLAYER_SAVED_AT, String(savedAt)],
    ]);
    // Fire-and-forget cloud sync — local save already succeeded
    CloudSyncService.savePlayerData(playerData, savedAt);
    return true;
  } catch (error) {
    console.error('Error saving player data:', error);
    return false;
  }
}

export function isValidPlayerData(data: unknown): data is PlayerData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.level === 'number' &&
    d.level >= 1 &&
    typeof d.experience === 'number' &&
    typeof d.attack === 'number' &&
    typeof d.defense === 'number' &&
    typeof d.totalDistance === 'number' &&
    typeof d.totalEncounters === 'number' &&
    typeof d.creaturesDefeated === 'number' &&
    typeof d.equipment === 'object' &&
    d.equipment !== null
  );
}

/**
 * Fetch the cloud player record and, if it is strictly newer than the local
 * snapshot, persist it locally and return it. Returns null when the cloud has
 * nothing newer (no record, not newer, or the read timed out).
 *
 * This is the cloud half of what used to be loadPlayerData(). It is deliberately
 * separated so the cold-start flow can paint the first screen from the LOCAL
 * snapshot (readLocalPlayerSnapshot) first and run this reconciliation AFTER the
 * initial render. The native Firestore read can synchronously block the JS
 * thread on Android New Architecture (the E2E-Android flake) — gating first
 * paint on it strands the user on "Loading…". Running it post-paint means the
 * screen is already committed before any potential freeze. See usePlayer.
 *
 * The local timestamp is re-read AFTER the cloud fetch resolves (not passed in
 * from before the read started), so progress the player earns while the read is
 * in flight — written via savePlayerData with a fresh timestamp — is never
 * clobbered by older cloud data.
 */
export async function reconcileCloudPlayerData(): Promise<PlayerData | null> {
  const cloudRecord = await CloudSyncService.loadPlayerData();
  if (cloudRecord === null || !isValidPlayerData(cloudRecord.playerData)) {
    return null;
  }
  const { savedAt: currentLocalSavedAt } = await readLocalPlayerSnapshot();
  if (cloudRecord.lastSavedAt > currentLocalSavedAt) {
    try {
      await writeLocalPlayerSnapshot(cloudRecord.playerData, cloudRecord.lastSavedAt);
    } catch (error) {
      console.error('reconcileCloudPlayerData: failed to persist cloud data locally:', error);
    }
    return cloudRecord.playerData;
  }
  return null;
}

/**
 * Save app settings
 */
export async function saveSettings(settings: AppSettings): Promise<boolean> {
  try {
    const jsonData = JSON.stringify(settings);
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, jsonData);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Load app settings
 */
export async function loadSettings(): Promise<AppSettings | null> {
  try {
    const jsonData = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (jsonData) {
      return JSON.parse(jsonData) as AppSettings;
    }
    return null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

/**
 * Save pending encounter (for background encounters)
 */
export async function savePendingEncounter(encounter: EncounterData): Promise<boolean> {
  try {
    const jsonData = JSON.stringify(encounter);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ENCOUNTER, jsonData);
    return true;
  } catch (error) {
    console.error('Error saving pending encounter:', error);
    return false;
  }
}

export function isValidEncounterData(data: unknown): data is EncounterData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const d = data as Record<string, unknown>;
  return (
    typeof d.creature === 'object' &&
    d.creature !== null &&
    typeof d.location === 'object' &&
    d.location !== null &&
    typeof d.timestamp === 'number' &&
    typeof d.playerLevel === 'number' &&
    (ENCOUNTER_STATUSES as readonly string[]).includes(d.status as string)
  );
}

/**
 * Load pending encounter (for background encounters)
 */
export async function loadPendingEncounter(): Promise<EncounterData | null> {
  try {
    const jsonData = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ENCOUNTER);
    if (jsonData) {
      const parsed: unknown = JSON.parse(jsonData);
      if (!isValidEncounterData(parsed)) {
        console.error('Corrupted encounter data in storage, clearing');
        await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ENCOUNTER);
        return null;
      }
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('Error loading pending encounter:', error);
    return null;
  }
}

/**
 * Clear pending encounter
 */
export async function clearPendingEncounter(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ENCOUNTER);
    return true;
  } catch (error) {
    console.error('Error clearing pending encounter:', error);
    return false;
  }
}

/**
 * Save whether location tracking was active when the app was last running.
 * Used to auto-resume tracking after an OS-kill/restart.
 */
export async function saveTrackingState(isTracking: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_STATE, JSON.stringify(isTracking));
    return true;
  } catch (error) {
    console.error('Error saving tracking state:', error);
    return false;
  }
}

/**
 * Load whether location tracking was active in the previous session.
 * Returns false if no state was saved or on error.
 */
export async function loadTrackingState(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_STATE);
    return value !== null ? (JSON.parse(value) as boolean) : false;
  } catch (error) {
    console.error('Error loading tracking state:', error);
    return false;
  }
}

/**
 * Clear only the local player data and its timestamp.
 * Used when switching accounts so the new account's cloud record always wins
 * the timestamp comparison in loadPlayerData.
 * Non-fatal: if the clear fails, initializePlayer still runs and the cloud record
 * wins via timestamp comparison anyway.
 */
export async function writeLocalPlayerSnapshot(data: PlayerData, savedAt: number): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.PLAYER_DATA, JSON.stringify(data)],
    [STORAGE_KEYS.PLAYER_SAVED_AT, String(savedAt)],
  ]);
}

export async function readLocalPlayerSnapshot(): Promise<{
  data: PlayerData | null;
  savedAt: number;
}> {
  try {
    const result = await AsyncStorage.multiGet([
      STORAGE_KEYS.PLAYER_DATA,
      STORAGE_KEYS.PLAYER_SAVED_AT,
    ]);
    const json = result?.[0]?.[1] ?? null;
    const savedAt = Number(result?.[1]?.[1] ?? 0);
    if (!json) return { data: null, savedAt: 0 };
    const parsed: unknown = JSON.parse(json);
    if (isValidPlayerData(parsed)) {
      return { data: parsed, savedAt };
    }
    // Corrupt/invalid local data — clear it so its stale timestamp can't block
    // cloud reconciliation, and report savedAt:0 (treated as no local save).
    await clearLocalPlayerData();
    return { data: null, savedAt: 0 };
  } catch {
    // JSON parse failed — same treatment: clear and report no local save.
    await clearLocalPlayerData();
    return { data: null, savedAt: 0 };
  }
}

export async function clearLocalPlayerData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEYS.PLAYER_DATA, STORAGE_KEYS.PLAYER_SAVED_AT]);
  } catch (error) {
    console.error('clearLocalPlayerData: storage error, proceeding with reload:', error);
  }
}

export async function writePendingConflict(record: PendingConflictRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CONFLICT_PENDING, JSON.stringify(record));
  } catch (error) {
    console.error('writePendingConflict: storage error:', error);
  }
}

export async function readPendingConflict(): Promise<PendingConflictRecord | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.CONFLICT_PENDING);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('localSavedAt' in parsed) ||
      !('cloudSavedAt' in parsed)
    )
      return null;
    return parsed as PendingConflictRecord;
  } catch {
    return null;
  }
}

export async function clearPendingConflict(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CONFLICT_PENDING);
  } catch (error) {
    console.error('clearPendingConflict: storage error:', error);
  }
}

/**
 * Clear all app data
 */
export async function clearAllData(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PLAYER_DATA,
      STORAGE_KEYS.PLAYER_SAVED_AT,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.PENDING_ENCOUNTER,
      STORAGE_KEYS.TRACKING_STATE,
      STORAGE_KEYS.CONFLICT_PENDING,
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}
