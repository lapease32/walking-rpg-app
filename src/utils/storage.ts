import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerData } from '../models/Player';

/**
 * Storage utilities for persisting player data
 */
const STORAGE_KEYS = {
  PLAYER_DATA: '@walking_rpg:player_data',
  SETTINGS: '@walking_rpg:settings',
} as const;

export interface AppSettings {
  [key: string]: any;
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
 * Clear all app data
 */
export async function clearAllData(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PLAYER_DATA,
      STORAGE_KEYS.SETTINGS,
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

