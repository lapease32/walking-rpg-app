import { Item, Affix, AffixStat } from '../models/Item';
import { Rarity } from '../models/Creature';
import { LOOT_CONFIG } from '../constants/config';

type ItemSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'boots' | 'gloves' | 'accessory';

const SLOTS: ItemSlot[] = [
  'weapon',
  'offhand',
  'head',
  'chest',
  'legs',
  'boots',
  'gloves',
  'accessory',
];

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Rarity probability weights [common, uncommon, rare, epic, legendary] by level band.
const RARITY_WEIGHTS: [number, number[]][] = [
  [15, [10, 25, 35, 25, 5]],
  [10, [20, 35, 30, 14, 1]],
  [5, [40, 40, 18, 2, 0]],
  [1, [65, 30, 5, 0, 0]],
];

// Base primary-stat range per rarity (pre-affix).
const BASE_RANGES: Record<Rarity, { min: number; max: number }> = {
  common: { min: 2, max: 5 },
  uncommon: { min: 6, max: 12 },
  rare: { min: 12, max: 20 },
  epic: { min: 20, max: 30 },
  legendary: { min: 28, max: 40 },
};

// Affix value range per rarity.
const AFFIX_RANGES: Record<Rarity, { min: number; max: number }> = {
  common: { min: 0, max: 0 },
  uncommon: { min: 2, max: 5 },
  rare: { min: 4, max: 9 },
  epic: { min: 6, max: 14 },
  legendary: { min: 10, max: 20 },
};

// Possible affix counts per rarity (picked uniformly from the array).
const AFFIX_COUNT_OPTIONS: Record<Rarity, number[]> = {
  common: [0],
  uncommon: [1],
  rare: [1, 2],
  epic: [2],
  legendary: [2, 3],
};

// Affix stat pool per slot — first entry is the primary stat, rest are secondary.
const AFFIX_POOLS: Record<ItemSlot, AffixStat[]> = {
  weapon: ['attack', 'defense', 'maxHp'],
  offhand: ['defense', 'maxHp', 'attack'],
  head: ['defense', 'maxHp', 'attack'],
  chest: ['defense', 'maxHp', 'attack'],
  legs: ['defense', 'maxHp', 'attack'],
  boots: ['defense', 'attack', 'maxHp'],
  gloves: ['attack', 'defense', 'maxHp'],
  accessory: ['attack', 'defense', 'maxHp'],
};

const BASE_NAMES: Record<ItemSlot, string[]> = {
  weapon: ['Blade', 'Axe', 'Staff', 'Dagger', 'Hammer'],
  offhand: ['Shield', 'Buckler', 'Focus'],
  head: ['Helm', 'Cap', 'Hood'],
  chest: ['Chestplate', 'Robe', 'Vest'],
  legs: ['Greaves', 'Pants', 'Leggings'],
  boots: ['Boots', 'Sabatons', 'Treads'],
  gloves: ['Gauntlets', 'Gloves', 'Grips'],
  accessory: ['Ring', 'Amulet', 'Pendant'],
};

const AFFIX_PREFIXES: Record<AffixStat, string[]> = {
  attack: ['Sharp', 'Deadly', 'Fierce', 'Savage', 'Keen'],
  defense: ['Sturdy', 'Hardened', 'Stalwart', 'Fortified', 'Reinforced'],
  maxHp: ['Vital', 'Hardy', 'Enduring', 'Resilient', 'Robust'],
};

const COMMON_PREFIXES = ['Worn', 'Battered', 'Plain'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollRarity(playerLevel: number): Rarity {
  const [, weights] = RARITY_WEIGHTS.find(([band]) => playerLevel >= band) ?? RARITY_WEIGHTS[3];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RARITIES[i];
  }
  return 'common';
}

function rollAffixes(slot: ItemSlot, rarity: Rarity): Affix[] {
  const count = pick(AFFIX_COUNT_OPTIONS[rarity]);
  if (count === 0) return [];
  const range = AFFIX_RANGES[rarity];
  const pool = [...AFFIX_POOLS[slot]];
  const affixes: Affix[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const stat = pool.splice(idx, 1)[0];
    affixes.push({ stat, value: randInt(range.min, range.max) });
  }
  return affixes;
}

function buildName(slot: ItemSlot, affixes: Affix[]): string {
  const base = pick(BASE_NAMES[slot]);
  if (affixes.length === 0) return `${pick(COMMON_PREFIXES)} ${base}`;
  const dominant = affixes.reduce((a, b) => (a.value >= b.value ? a : b));
  return `${pick(AFFIX_PREFIXES[dominant.stat])} ${base}`;
}

export function generateItem(playerLevel = 1, rarityOverride?: Rarity): Item {
  const slot = pick(SLOTS);
  // rarityOverride is a debug-only hook (DebugPanel "Drop Rarity" / "Preview Reveal"); normal
  // play always rolls. Stats/affixes still derive from the resulting rarity either way.
  const rarity = rarityOverride ?? rollRarity(playerLevel);
  const primaryStat = AFFIX_POOLS[slot][0];
  const baseRange = BASE_RANGES[rarity];
  const baseValue = randInt(baseRange.min, baseRange.max);
  const affixes = rollAffixes(slot, rarity);

  // Pre-bake affix values into the item's stat fields.
  let attack: number | undefined;
  let defense: number | undefined;
  let maxHp: number | undefined;

  if (primaryStat === 'attack') attack = baseValue;
  else if (primaryStat === 'defense') defense = baseValue;
  else maxHp = baseValue;

  for (const { stat, value } of affixes) {
    if (stat === 'attack') attack = (attack ?? 0) + value;
    else if (stat === 'defense') defense = (defense ?? 0) + value;
    else maxHp = (maxHp ?? 0) + value;
  }

  const id = `gen_${slot}_${Date.now()}_${randInt(0, 9999)}`;
  const base = {
    id,
    name: buildName(slot, affixes),
    description: `A ${rarity} ${slot}.`,
    rarity,
    level: Math.max(1, playerLevel - 1),
    dropChance: 0,
    affixes,
    ...(attack !== undefined ? { attack } : {}),
    ...(defense !== undefined ? { defense } : {}),
    ...(maxHp !== undefined ? { maxHp, hp: maxHp } : {}),
  };

  if (slot === 'weapon') return { ...base, type: 'weapon', slot: 'weapon' };
  if (slot === 'offhand') return { ...base, type: 'offhand', slot: 'offhand' };
  if (slot === 'head') return { ...base, type: 'head', slot: 'head' };
  if (slot === 'chest') return { ...base, type: 'chest', slot: 'chest' };
  if (slot === 'legs') return { ...base, type: 'legs', slot: 'legs' };
  if (slot === 'boots') return { ...base, type: 'boots', slot: 'boots' };
  if (slot === 'gloves') return { ...base, type: 'gloves', slot: 'gloves' };
  return { ...base, type: 'accessory' };
}

export function shouldDropItem(): boolean {
  return Math.random() < LOOT_CONFIG.BASE_DROP_CHANCE;
}

export function dropItem(
  forceDrop = false,
  playerLevel = 1,
  rarityOverride?: Rarity | null,
): Item | null {
  if (forceDrop || shouldDropItem()) {
    return generateItem(playerLevel, rarityOverride ?? undefined);
  }
  return null;
}
