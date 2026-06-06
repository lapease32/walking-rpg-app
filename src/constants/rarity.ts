import { Rarity } from '../models/Creature';

/**
 * Canonical rarity → color map. Single source of truth for rarity coloring across
 * the UI (item cards, inventory comparison, the loot-reveal particle "tell").
 */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9E9E9E',
  uncommon: '#4CAF50',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

export const getRarityColor = (rarity: Rarity): string =>
  RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
