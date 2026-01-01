/**
 * Loot Service
 * Handles item drops from defeated creatures
 */

import { Item } from '../models/Item';
import { ALL_ITEMS } from '../models/items';

/**
 * Configuration for loot drops
 */
const LOOT_CONFIG = {
  // Base chance that a creature will drop an item (0.0 to 1.0)
  BASE_DROP_CHANCE: 0.3, // 30% chance to drop an item
} as const;

/**
 * Calculate if a creature should drop an item
 * @returns true if an item should be dropped
 */
export function shouldDropItem(): boolean {
  return Math.random() < LOOT_CONFIG.BASE_DROP_CHANCE;
}

/**
 * Select a random item from all available items
 * All items have equal probability (rarity is not considered)
 * @returns A random item, or null if no items are available
 */
export function selectRandomItem(): Item | null {
  if (ALL_ITEMS.length === 0) {
    return null;
  }

  // Select a random item with equal probability for all items
  // Return a shallow copy to ensure each dropped item is unique
  const randomIndex = Math.floor(Math.random() * ALL_ITEMS.length);
  return { ...ALL_ITEMS[randomIndex] };
}

/**
 * Attempt to drop an item from a defeated creature
 * @returns The dropped item, or null if no item was dropped
 */
export function dropItem(): Item | null {
  if (shouldDropItem()) {
    return selectRandomItem();
  }
  return null;
}

