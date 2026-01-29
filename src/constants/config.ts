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

  // Maximum distance (in meters) from encounter location before auto-flee
  AUTO_FLEE_DISTANCE: 100, // Auto-flee if user travels 100m away from encounter
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

import { ENV_CONFIG } from './environment';

/** Valid positions for the environment banner */
export type BannerPosition = 'top' | 'bottom' | 'inline';

/** Valid style variants for the environment banner */
export type BannerVariant = 'badge' | 'banner';

/** Environment banner display configuration */
export interface EnvironmentBannerConfig {
  visible: boolean;
  position: BannerPosition;
  variant: BannerVariant;
  buildType: typeof ENV_CONFIG.environmentName;
}

/**
 * App distribution and version configuration
 */
export const APP_CONFIG = {
  // Version string to display
  // Update this when creating new beta builds
  VERSION: '1.0.0-beta.1',

  // Environment banner display options (shows build type)
  ENVIRONMENT_BANNER: {
    visible: ENV_CONFIG.showEnvironmentBanner,
    position: 'top',
    variant: 'banner',
    buildType: ENV_CONFIG.environmentName,
  } satisfies EnvironmentBannerConfig,
} as const;

