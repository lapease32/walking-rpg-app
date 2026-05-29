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

  // Maximum number of item slots in the player's inventory
  MAX_INVENTORY_SIZE: 50,
} as const;

import { Rarity } from '../models/Creature';

export const CREATURE_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 15,
  epic: 4,
  legendary: 1,
};

// Probability weights for item drops — skewed slightly more generous than creature rarity
export const ITEM_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 55,
  uncommon: 28,
  rare: 12,
  epic: 4,
  legendary: 1,
};

// Stat multipliers applied to base item stats per rarity tier
export const ITEM_RARITY_STAT_MULTIPLIERS: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.3,
  rare: 1.7,
  epic: 2.3,
  legendary: 3.2,
};

export const LOOT_CONFIG = {
  // Base probability of any loot dropping from an idle auto-combat win
  BASE_DROP_CHANCE: 0.4,

  // Additional drop chance when player wins via active (manual) combat
  ACTIVE_COMBAT_DROP_CHANCE_BONUS: 0.2,

  // How much better item stat rolls are when earned through active combat
  ACTIVE_COMBAT_LOOT_MULTIPLIER: 2.0,

  // Maximum number of items that can drop from a single encounter
  MAX_DROPS_PER_ENCOUNTER: 2,

  // Proportional variance applied to item stat rolls (e.g. 0.15 = ±15%)
  ITEM_STAT_VARIANCE: 0.15,
} as const;

export const COMBAT_CONFIG = {
  // Probability that auto-combat (idle) wins an encounter at even level
  AUTO_COMBAT_BASE_WIN_RATE: 0.75,

  // XP multiplier for winning via active (manual) combat vs idle
  ACTIVE_COMBAT_XP_MULTIPLIER: 1.5,

  // XP earned from a loss (partial credit for attempting the encounter)
  LOSS_XP_FRACTION: 0.25,
} as const;

// Each zone is this many km from the player's session start point.
// Enemies and loot quality scale with the zone the player is currently in.
export const WORLD_CONFIG = {
  ZONE_SIZE_KM: 1.0,

  // Flat enemy level bonus added per zone beyond zone 0
  ZONE_ENEMY_LEVEL_BONUS: 2,

  // Additive loot quality bonus per zone (e.g. 0.1 = +10% per zone)
  ZONE_LOOT_QUALITY_BONUS: 0.1,

  // Hard cap on zone scaling — prevents infinite difficulty for ultra-long walks
  MAX_ZONE: 10,
} as const;

export const WALKING_SPEED = {
  MIN_KMH: 3, // Minimum speed to be considered walking
  MAX_KMH: 8, // Maximum speed to be considered walking
} as const;

import { DirectAbility } from '../models/Ability';

// satisfies per-entry validates the shape; as const preserves deep literal types.
export const ATTACK_TYPES = {
  BASIC: {
    id: 'basic_attack',
    name: 'Basic Attack',
    primitive: 'direct',
    damageMultiplier: 1.0,
    cooldownMs: 1000,
    resourceCost: 0,
    icon: '⚔️',
    damageType: 'physical',
  } satisfies DirectAbility,
  STRONG: {
    id: 'strong_attack',
    name: 'Strong Attack',
    primitive: 'direct',
    damageMultiplier: 1.5,
    cooldownMs: 3000,
    resourceCost: 0,
    icon: '💥',
    damageType: 'physical',
  } satisfies DirectAbility,
  HEAVY: {
    id: 'heavy_attack',
    name: 'Heavy Attack',
    primitive: 'direct',
    damageMultiplier: 2.0,
    cooldownMs: 5000,
    resourceCost: 0,
    icon: '🔨',
    damageType: 'physical',
  } satisfies DirectAbility,
} as const;

export type AttackType = keyof typeof ATTACK_TYPES;

import { ENV_CONFIG } from './environment';

/** Valid positions for the environment banner */
export type BannerPosition = 'top' | 'bottom' | 'inline';

/** Valid style variants for the environment banner */
export type BannerVariant = 'badge' | 'banner';

/** Environment banner display configuration (internal type for satisfies check) */
interface EnvironmentBannerConfig {
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
