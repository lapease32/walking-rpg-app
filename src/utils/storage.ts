import logger from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerData } from '../models/Player';
import { CreatureConstructorParams, Rarity } from '../models/Creature';
import { Item } from '../models/Item';
import { Location, EncounterStatus, ENCOUNTER_STATUSES } from '../models/Encounter';
import type { ThemeName, ThemePreference } from '../constants/theme';
import CloudSyncService from '../services/CloudSyncService';

/**
 * Storage utilities for persisting player data
 */
const STORAGE_KEYS = {
  PLAYER_DATA: '@walking_rpg:player_data',
  PLAYER_SAVED_AT: '@walking_rpg:player_saved_at',
  SETTINGS: '@walking_rpg:settings',
  PENDING_ENCOUNTER: '@walking_rpg:pending_encounter',
  WALK_SUMMARY: '@walking_rpg:walk_summary',
  TRACKING_STATE: '@walking_rpg:tracking_state',
  CONFLICT_PENDING: '@walking_rpg:conflict_pending',
  BATTERY_PROMPT_SHOWN: '@walking_rpg:battery_prompt_shown',
  AUTO_RESOLVE_BELOW_RARE: '@walking_rpg:auto_resolve_below_rare',
} as const;

// Cap the persisted walk-summary log so an unusually long walk (many auto-resolved encounters)
// can't grow AsyncStorage without bound. Rewards are already applied to the player when each
// entry is written, so trimming the oldest display records is loss-free — only the summary UI
// (which shows totals + recent detail) is affected.
const MAX_WALK_SUMMARY_ENTRIES = 100;

export interface PendingConflictRecord {
  localData: PlayerData | null;
  localSavedAt: number;
  cloudData: PlayerData | null;
  cloudSavedAt: number;
}

/**
 * Persisted user settings. Concrete + typed (it was an untyped `[key: string]: any` bag with no
 * consumers) so a bad key is a compile error. New settings add a field here.
 */
export interface AppSettings {
  /** What the player picked: 'auto' (follow the real sun), 'night', or 'day'. Absent = 'auto'. */
  themePreference?: ThemePreference;
  /**
   * @deprecated Superseded by `themePreference` when 'auto' was introduced. Still READ, so a save
   * written before the sun clock keeps the player's explicit night/day choice; never written.
   */
  themeName?: ThemeName;
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
  /** Daylight at spawn — so a held elite reloaded from storage keeps its stage art key.
   *  Optional for backward-compat with encounters persisted before the field existed. */
  daylight?: boolean;
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
    logger.error('Error saving player data:', error);
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
/**
 * Result of reconciling local vs cloud, kept distinct so callers can tell a CONFIRMED-missing
 * cloud save apart from a read that simply FAILED — the distinction that prevents a fresh
 * character from overwriting a real save the read couldn't reach.
 */
export type ReconcileResult =
  | { status: 'adopted'; data: PlayerData } // cloud existed AND was strictly newer → written local
  | { status: 'noNewerCloud' } //              cloud confirmed empty OR not newer → keep local
  | { status: 'unavailable' }; //              cloud read failed / timed out / corrupt → unknown

export async function reconcileCloudPlayerData(): Promise<ReconcileResult> {
  const cloud = await CloudSyncService.loadPlayerData();
  if (cloud.status === 'unavailable') {
    return { status: 'unavailable' };
  }
  if (cloud.status === 'empty') {
    return { status: 'noNewerCloud' };
  }
  // cloud.status === 'found'
  if (!isValidPlayerData(cloud.record.playerData)) {
    // Read succeeded but the doc is malformed. Treat as UNAVAILABLE, not empty — a validator
    // false-negative must never let a fresh character overwrite a (possibly real) cloud save.
    logger.warn('reconcileCloudPlayerData: cloud doc failed validation — treating as unavailable');
    return { status: 'unavailable' };
  }
  const { savedAt: currentLocalSavedAt } = await readLocalPlayerSnapshot();
  if (cloud.record.lastSavedAt > currentLocalSavedAt) {
    try {
      await writeLocalPlayerSnapshot(cloud.record.playerData, cloud.record.lastSavedAt);
    } catch (error) {
      logger.error('reconcileCloudPlayerData: failed to persist cloud data locally:', error);
    }
    return { status: 'adopted', data: cloud.record.playerData };
  }
  return { status: 'noNewerCloud' };
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
    logger.error('Error saving settings:', error);
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
    logger.error('Error loading settings:', error);
    return null;
  }
}

/**
 * Save a held encounter — the "worthy foe" store. Holds an ELITE encounter that fired while the app
 * was backgrounded so the player can engage it turn-based on their next foreground (see
 * useEncounter.holdEliteEncounter). Common encounters auto-resolve passively and are NOT saved here.
 */
export async function savePendingEncounter(encounter: EncounterData): Promise<boolean> {
  try {
    const jsonData = JSON.stringify(encounter);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ENCOUNTER, jsonData);
    return true;
  } catch (error) {
    logger.error('Error saving pending encounter:', error);
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
        logger.error('Corrupted encounter data in storage, clearing');
        await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ENCOUNTER);
        return null;
      }
      return parsed;
    }
    return null;
  } catch (error) {
    logger.error('Error loading pending encounter:', error);
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
    logger.error('Error clearing pending encounter:', error);
    return false;
  }
}

/**
 * One passively-resolved encounter, recorded for the "while you walked" summary shown on return.
 * This is a DISPLAY record only — the XP/item were already applied to the player when it was
 * written, so losing this log never loses rewards.
 */
export interface WalkSummaryEntry {
  creatureName: string;
  rarity: Rarity;
  won: boolean;
  xpGained: number;
  item: Item | null;
  timestamp: number;
}

function isValidWalkSummaryEntry(data: unknown): data is WalkSummaryEntry {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const d = data as Record<string, unknown>;
  return (
    typeof d.creatureName === 'string' &&
    typeof d.rarity === 'string' &&
    typeof d.won === 'boolean' &&
    typeof d.xpGained === 'number' &&
    typeof d.timestamp === 'number' &&
    (d.item === null || (typeof d.item === 'object' && d.item !== null))
  );
}

/**
 * Load the accumulated walk-summary log (oldest → newest). Returns [] when empty or corrupted
 * (corrupted storage is cleared so it can't wedge the summary on every foreground).
 */
export async function loadWalkSummary(): Promise<WalkSummaryEntry[]> {
  try {
    const jsonData = await AsyncStorage.getItem(STORAGE_KEYS.WALK_SUMMARY);
    if (!jsonData) {
      return [];
    }
    const parsed: unknown = JSON.parse(jsonData);
    if (!Array.isArray(parsed) || !parsed.every(isValidWalkSummaryEntry)) {
      logger.error('Corrupted walk-summary data in storage, clearing');
      await AsyncStorage.removeItem(STORAGE_KEYS.WALK_SUMMARY);
      return [];
    }
    return parsed;
  } catch (error) {
    logger.error('Error loading walk summary:', error);
    return [];
  }
}

// Serializes appendWalkSummaryEntry's read-modify-write. Passive resolutions are fired from
// un-awaited GPS distance callbacks, so two can overlap; without this chain their load→setItem
// could interleave and silently drop entries. Each append waits for the previous to finish.
let walkSummaryWriteChain: Promise<void> = Promise.resolve();

/**
 * Append one resolved-encounter record to the walk-summary log, trimmed to the most recent
 * MAX_WALK_SUMMARY_ENTRIES. The read-modify-write is serialized through a module-level chain so
 * concurrent appends queue instead of racing (a race could otherwise drop entries).
 */
export async function appendWalkSummaryEntry(entry: WalkSummaryEntry): Promise<boolean> {
  const run = walkSummaryWriteChain.then(async () => {
    const existing = await loadWalkSummary();
    const next = [...existing, entry].slice(-MAX_WALK_SUMMARY_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEYS.WALK_SUMMARY, JSON.stringify(next));
  });
  // Keep the chain alive even if this write throws, so one failure can't wedge later appends.
  walkSummaryWriteChain = run.catch(() => {});
  try {
    await run;
    return true;
  } catch (error) {
    logger.error('Error appending walk summary entry:', error);
    return false;
  }
}

/**
 * Atomically read AND clear the walk-summary log, returning the drained entries. Runs on the same
 * serialization chain as appendWalkSummaryEntry, so a concurrent passive append can't land between
 * the read and the clear (which would otherwise wipe a just-appended, never-shown fight). An append
 * either finishes before this drain (included in the result) or after it (persisted for next time).
 */
export async function drainWalkSummary(): Promise<WalkSummaryEntry[]> {
  const run = walkSummaryWriteChain.then(async () => {
    const entries = await loadWalkSummary();
    if (entries.length > 0) {
      await AsyncStorage.removeItem(STORAGE_KEYS.WALK_SUMMARY);
    }
    return entries;
  });
  // Keep the chain alive (as void) regardless of this drain's outcome.
  walkSummaryWriteChain = run.then(
    () => {},
    () => {},
  );
  try {
    return await run;
  } catch (error) {
    logger.error('Error draining walk summary:', error);
    return [];
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
    logger.error('Error saving tracking state:', error);
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
    logger.error('Error loading tracking state:', error);
    return false;
  }
}

/**
 * Save the player's "auto-resolve below-rare encounters" (idle-mode) preference. Device-level,
 * like the battery-prompt flag: it's a play-style setting, not account data, so it survives account
 * switches and is wiped only by a full reset (clearAllData), not account deletion.
 */
export async function saveAutoResolveBelowRare(enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_RESOLVE_BELOW_RARE, JSON.stringify(enabled));
    return true;
  } catch (error) {
    logger.error('Error saving auto-resolve setting:', error);
    return false;
  }
}

/**
 * Load the "auto-resolve below-rare encounters" preference. Defaults to false — active-by-default:
 * every foreground encounter is a real fight until the player opts into skipping trivial ones.
 */
export async function loadAutoResolveBelowRare(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_RESOLVE_BELOW_RARE);
    return value !== null ? (JSON.parse(value) as boolean) : false;
  } catch (error) {
    logger.error('Error loading auto-resolve setting:', error);
    return false;
  }
}

/**
 * Mark that the Android battery-optimization exemption prompt has been shown, so it's only ever
 * asked once (we never re-nag a user who declined — they can still enable it in system settings).
 */
export async function setBatteryPromptShown(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BATTERY_PROMPT_SHOWN, JSON.stringify(true));
    return true;
  } catch (error) {
    logger.error('Error saving battery-prompt-shown flag:', error);
    return false;
  }
}

/**
 * Whether the battery-optimization exemption prompt has already been shown. Returns false if
 * never shown or on error (fail-open is harmless — at worst the prompt shows once more).
 */
export async function hasBatteryPromptBeenShown(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.BATTERY_PROMPT_SHOWN);
    return value !== null ? (JSON.parse(value) as boolean) : false;
  } catch (error) {
    logger.error('Error loading battery-prompt-shown flag:', error);
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
    // WALK_SUMMARY (passive haul) and PENDING_ENCOUNTER (a held "worthy foe") are per-account
    // activity — clear them on account switch so the next user can't see or fight the previous
    // account's data (in-memory state is cleared separately by useEncounter.clearEncounter).
    // Account DELETION uses clearAllUserData.
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PLAYER_DATA,
      STORAGE_KEYS.PLAYER_SAVED_AT,
      STORAGE_KEYS.WALK_SUMMARY,
      STORAGE_KEYS.PENDING_ENCOUNTER,
    ]);
  } catch (error) {
    logger.error('clearLocalPlayerData: storage error, proceeding with reload:', error);
  }
}

/**
 * Wipe ALL per-user local data — used by account deletion (GDPR / Apple 5.1.1(v)) so no
 * trace of the deleted account survives into the next (fresh anonymous) session. Single
 * source of truth for "everything tied to the user"; add new per-user keys here. SETTINGS
 * is intentionally excluded — it's device-level app preferences, not account data.
 */
export async function clearAllUserData(): Promise<void> {
  // Intentionally does NOT swallow errors (unlike clearLocalPlayerData): account deletion
  // runs this after a successful auth deletion and retries on failure rather than silently
  // continuing as if erasure succeeded — leftover local data would resurrect under the next
  // session. The caller (handleDeleteAccount) owns the retry; this just surfaces the error.
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.PLAYER_DATA,
    STORAGE_KEYS.PLAYER_SAVED_AT,
    STORAGE_KEYS.PENDING_ENCOUNTER,
    STORAGE_KEYS.WALK_SUMMARY,
    STORAGE_KEYS.TRACKING_STATE,
    STORAGE_KEYS.CONFLICT_PENDING,
  ]);
}

export async function writePendingConflict(record: PendingConflictRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CONFLICT_PENDING, JSON.stringify(record));
  } catch (error) {
    logger.error('writePendingConflict: storage error:', error);
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
    logger.error('clearPendingConflict: storage error:', error);
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
      STORAGE_KEYS.AUTO_RESOLVE_BELOW_RARE,
    ]);
    return true;
  } catch (error) {
    logger.error('Error clearing data:', error);
    return false;
  }
}
