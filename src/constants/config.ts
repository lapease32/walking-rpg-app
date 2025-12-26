/**
 * App configuration constants
 */

export const ENCOUNTER_CONFIG = {
  // Minimum distance (in meters) before an encounter can occur
  MIN_ENCOUNTER_DISTANCE: 50,

  // Encounter probability per meter after minimum distance
  ENCOUNTER_CHANCE_PER_METER: 0.001, // 0.1% per meter

  // Minimum time (in ms) between encounters
  MIN_TIME_BETWEEN_ENCOUNTERS: 30000, // 30 seconds
} as const;

export const LOCATION_CONFIG = {
  // GPS accuracy requirements
  ENABLE_HIGH_ACCURACY: true,
  TIMEOUT: 15000,
  MAXIMUM_AGE: 10000,

  // Minimum distance (in meters) to trigger location update
  DISTANCE_FILTER: 5,

  // Maximum distance to consider valid (filters GPS jumps)
  MAX_VALID_DISTANCE: 1000, // meters
} as const;

export const PLAYER_CONFIG = {
  // Starting stats
  STARTING_LEVEL: 1,
  STARTING_EXPERIENCE: 0,

  // Starting combat stats
  STARTING_ATTACK: 20,
  STARTING_DEFENSE: 5,
  STARTING_HP: 100,

  // Stats increase per level
  ATTACK_PER_LEVEL: 3,
  DEFENSE_PER_LEVEL: 2,
  HP_PER_LEVEL: 10,

  // Experience calculation
  BASE_EXPERIENCE_MULTIPLIER: 100,
  EXPERIENCE_POWER: 1.5,
} as const;

import { Rarity } from '../models/Creature';

export const CREATURE_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 15,
  epic: 4,
  legendary: 1,
};

export const WALKING_SPEED = {
  MIN_KMH: 3, // Minimum speed to be considered walking
  MAX_KMH: 8, // Maximum speed to be considered walking
} as const;

export const ATTACK_TYPES = {
  BASIC: {
    name: 'Basic Attack',
    damageMultiplier: 1.0,
    cooldownMs: 1000, // 1 second
    icon: '⚔️',
  },
  STRONG: {
    name: 'Strong Attack',
    damageMultiplier: 1.5,
    cooldownMs: 3000, // 3 seconds
    icon: '💥',
  },
  HEAVY: {
    name: 'Heavy Attack',
    damageMultiplier: 2.0,
    cooldownMs: 5000, // 5 seconds
    icon: '🔨',
  },
} as const;

export type AttackType = keyof typeof ATTACK_TYPES;

