import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerData } from '../models/Player';
import { CreatureConstructorParams } from '../models/Creature';
import { Location, EncounterStatus } from '../models/Encounter';

/**
 * Storage utilities for persisting player data
 */
const STORAGE_KEYS = {
  PLAYER_DATA: '@walking_rpg:player_data',
  SETTINGS: '@walking_rpg:settings',
  PENDING_ENCOUNTER: '@walking_rpg:pending_encounter',
} as const;

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

/**
 * Save player data to local storage
 */
export async function savePlayerData(player: { toJSON(): PlayerData }): Promise<boolean> {
  try {
    const jsonData = JSON.stringify(player.toJSON());
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_DATA, jsonData);
    return true;
  } catch (error) {
    console.error('Error saving player data:', error);
    return false;
  }
}

/**
 * Load player data from local storage
 */
export async function loadPlayerData(): Promise<PlayerData | null> {
  try {
    const jsonData = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER_DATA);
    if (jsonData) {
      return JSON.parse(jsonData) as PlayerData;
    }
    return null;
  } catch (error) {
    console.error('Error loading player data:', error);
    return null;
  }
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

/**
 * Load pending encounter (for background encounters)
 */
export async function loadPendingEncounter(): Promise<EncounterData | null> {
  try {
    const jsonData = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ENCOUNTER);
    if (jsonData) {
      return JSON.parse(jsonData);
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
 * Clear all app data
 */
export async function clearAllData(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PLAYER_DATA,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.PENDING_ENCOUNTER,
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

