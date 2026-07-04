import { Resistances, DEFAULT_RESISTANCES } from './DamageType';
import { mitigateDamage } from './combat';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CreatureTemplate {
  id: string;
  name: string;
  type: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity: Rarity;
  description?: string;
  encounterRate: number;
  resistances?: Partial<Resistances>;
}

export interface CreatureConstructorParams {
  id: string;
  name: string;
  type: string;
  level?: number;
  hp?: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity?: Rarity;
  description?: string;
  encounterRate?: number;
  resistances?: Partial<Resistances>;
}

export class Creature {
  id: string;
  name: string;
  type: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  rarity: Rarity;
  description: string;
  encounterRate: number;
  resistances: Resistances;

  constructor({
    id,
    name,
    type,
    level = 1,
    hp,
    maxHp,
    attack,
    defense,
    speed,
    rarity = 'common',
    description,
    encounterRate = 0.5,
    resistances,
  }: CreatureConstructorParams) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.level = level;
    this.hp = hp ?? maxHp;
    this.maxHp = maxHp;
    this.attack = attack;
    this.defense = defense;
    this.speed = speed;
    this.rarity = rarity;
    this.description = description || `A ${type} creature`;
    this.encounterRate = encounterRate;
    this.resistances = { ...DEFAULT_RESISTANCES, ...resistances };
  }

  /**
   * Get rarity multiplier for rewards
   */
  getRarityMultiplier(): number {
    const multipliers: Record<Rarity, number> = {
      common: 1.0,
      uncommon: 1.5,
      rare: 2.0,
      epic: 3.0,
      legendary: 5.0,
    };
    return multipliers[this.rarity] || 1.0;
  }

  /**
   * Calculate experience reward based on creature stats
   */
  getExperienceReward(): number {
    const baseExp = 10 * this.level;
    return Math.floor(baseExp * this.getRarityMultiplier());
  }

  /**
   * Check if creature is defeated
   */
  isDefeated(): boolean {
    return this.hp <= 0;
  }

  /**
   * Take damage
   * Note: amount should already account for defense (calculated by Player.calculateDamage)
   */
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
   * Calculate damage dealt to a player, via the shared ratio-based mitigation (see mitigateDamage).
   */
  calculateDamage(playerDefense: number): number {
    return mitigateDamage(this.attack, playerDefense);
  }
}

/**
 * Predefined creature templates
 * You can expand this with more creatures
 */
export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  {
    id: 'forest_sprite',
    name: 'Forest Sprite',
    type: 'Nature',
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
    rarity: 'common',
    description: 'A small nature spirit found in wooded areas',
    encounterRate: 0.6,
  },
  {
    id: 'urban_phantom',
    name: 'Urban Phantom',
    type: 'Shadow',
    maxHp: 60,
    attack: 18,
    defense: 8,
    speed: 25,
    rarity: 'common',
    description: 'A mysterious entity that appears in city areas',
    encounterRate: 0.5,
  },
  {
    id: 'coastal_spirit',
    name: 'Coastal Spirit',
    type: 'Water',
    maxHp: 70,
    attack: 20,
    defense: 10,
    speed: 15,
    rarity: 'uncommon',
    description: 'A spirit drawn to bodies of water',
    encounterRate: 0.3,
  },
  {
    id: 'mountain_guardian',
    name: 'Mountain Guardian',
    type: 'Earth',
    // Rebalanced down from 100/25/20: the old defense (20) exceeded a L1 player's attack (19),
    // so the subtractive damage formula floored player damage at 1/hit — a mathematically
    // unwinnable wall. 80/20/12 makes it a tough-but-beatable rare at the levels it now appears.
    maxHp: 80,
    attack: 20,
    defense: 12,
    speed: 10,
    rarity: 'rare',
    description: 'A powerful guardian of elevated terrain',
    encounterRate: 0.15,
  },
  {
    id: 'wind_dancer',
    name: 'Wind Dancer',
    type: 'Air',
    maxHp: 55,
    attack: 22,
    defense: 6,
    speed: 35,
    rarity: 'uncommon',
    description: 'An agile creature that moves with the wind',
    encounterRate: 0.35,
  },
  // ─── ELITE roster (rare/epic) — the "worthy foe" turn-based fights. Varied stat profiles +
  // resist/vulnerability pairs so damage-type choice matters (PR 3 resistances). All stats +
  // resistances are balance PLACEHOLDERS, tuned via playtest.
  {
    id: 'grove_warden',
    name: 'Grove Warden',
    type: 'Nature',
    // Bark-armored tank: shrugs off physical, but wood burns.
    maxHp: 95,
    attack: 22,
    defense: 15,
    speed: 12,
    rarity: 'rare',
    description: "An ancient guardian woven from the forest's oldest roots.",
    encounterRate: 0.15,
    resistances: { physical: 0.2, fire: -0.25 },
  },
  {
    id: 'void_stalker',
    name: 'Void Stalker',
    type: 'Shadow',
    // Glass predator: hits hard and fast, fragile; unbothered by frost.
    maxHp: 72,
    attack: 28,
    defense: 8,
    speed: 30,
    rarity: 'rare',
    description: 'A predator from between the streetlights — all fang and shadow.',
    encounterRate: 0.12,
    resistances: { frost: 0.25 },
  },
  {
    id: 'tidal_behemoth',
    name: 'Tidal Behemoth',
    type: 'Water',
    // HP bruiser: soaks damage, douses fire, but frost locks it down.
    maxHp: 115,
    attack: 21,
    defense: 13,
    speed: 8,
    rarity: 'rare',
    description: 'A leviathan that drags the tide behind it.',
    encounterRate: 0.12,
    resistances: { fire: 0.3, frost: -0.25 },
  },
  {
    id: 'ashen_colossus',
    name: 'Ashen Colossus',
    type: 'Earth',
    // Epic wall: heavy HP + armor, fire-forged (resists fire/physical), cracks under frost.
    maxHp: 150,
    attack: 30,
    defense: 20,
    speed: 8,
    rarity: 'epic',
    description: 'A mountain given wrath; its every step splits the earth.',
    encounterRate: 0.06,
    resistances: { fire: 0.4, physical: 0.15, frost: -0.2 },
  },
  {
    id: 'tempest_djinn',
    name: 'Tempest Djinn',
    type: 'Air',
    // Epic striker: blistering attack + speed, rides out frost, thin armor.
    maxHp: 120,
    attack: 36,
    defense: 14,
    speed: 32,
    rarity: 'epic',
    description: 'A storm bound into furious form.',
    encounterRate: 0.06,
    resistances: { frost: 0.3, physical: -0.15 },
  },
];

/**
 * Create a creature instance from a template with random level variation
 */
export function createCreatureFromTemplate(
  template: CreatureTemplate,
  playerLevel: number = 1,
): Creature {
  // Level variation: ±2 levels from player level, minimum 1
  const levelVariation = Math.floor(Math.random() * 5) - 2;
  const level = Math.max(1, playerLevel + levelVariation);

  // Scale stats based on level
  const levelMultiplier = 1 + (level - 1) * 0.1;

  return new Creature({
    ...template,
    level,
    maxHp: Math.floor(template.maxHp * levelMultiplier),
    attack: Math.floor(template.attack * levelMultiplier),
    defense: Math.floor(template.defense * levelMultiplier),
    speed: Math.floor(template.speed * levelMultiplier),
  });
}

// Encounter rarity weights by player level. Early levels skew hard to common (winnable with
// starting stats); ELITE rarities (rare, then epic) phase in with level — "constrain early, open
// late." Rare alone plateaus at the top as epic takes the higher slots, but total elite frequency
// keeps rising. Only rarities that have templates appear here. Weights are balance PLACEHOLDERS
// (tune via playtest); they need not sum to 100 (rollEncounterRarity normalizes by total).
// Ordered high→low minLevel; the first band whose minLevel <= playerLevel applies.
const ENCOUNTER_RARITY_WEIGHTS: [number, Partial<Record<Rarity, number>>][] = [
  [20, { common: 25, uncommon: 45, rare: 18, epic: 12 }],
  [12, { common: 32, uncommon: 48, rare: 16, epic: 4 }],
  [6, { common: 40, uncommon: 45, rare: 15 }],
  [3, { common: 55, uncommon: 43, rare: 2 }],
  [1, { common: 85, uncommon: 15, rare: 0 }],
];

/** Weighted-random encounter rarity for a player level (see ENCOUNTER_RARITY_WEIGHTS). */
export function rollEncounterRarity(playerLevel: number): Rarity {
  const [, weights] =
    ENCOUNTER_RARITY_WEIGHTS.find(([minLevel]) => playerLevel >= minLevel) ??
    ENCOUNTER_RARITY_WEIGHTS[ENCOUNTER_RARITY_WEIGHTS.length - 1];
  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, w] of entries) {
    roll -= w;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

/**
 * Pick an encounter creature template weighted by player level: roll a rarity (level-scaled),
 * then a uniform-random template of that rarity. Falls back to the full pool if no template of
 * the rolled rarity exists (keeps the function safe if the template set changes).
 */
export function pickEncounterTemplate(playerLevel: number = 1): CreatureTemplate {
  const rarity = rollEncounterRarity(playerLevel);
  return pickEncounterTemplateOfRarity(rarity);
}

/**
 * Pick a random template of a SPECIFIC rarity — used by debug encounter-forcing to reliably spawn a
 * common (→ passive) or elite (→ held) creature. Falls back to the full pool if no template of that
 * rarity exists (e.g. legendary, none authored yet), so callers always get a real template.
 */
export function pickEncounterTemplateOfRarity(rarity: Rarity): CreatureTemplate {
  const ofRarity = CREATURE_TEMPLATES.filter(t => t.rarity === rarity);
  const pool = ofRarity.length > 0 ? ofRarity : CREATURE_TEMPLATES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Rarities that make a creature "elite" — a worthy foe HELD for a deliberate turn-based fight
// (better loot) instead of being auto-resolved passively while walking. Tunable; today only `rare`
// has a template, so elites phase in with level via ENCOUNTER_RARITY_WEIGHTS (0% at L1-2 … 35% at
// L12+). epic/legendary are future content but classify as elite when templates are added.
export const ELITE_RARITIES: readonly Rarity[] = ['rare', 'epic', 'legendary'];

/**
 * True if a creature is "elite" (rare+): held for a deliberate turn-based fight rather than
 * auto-resolved passively. Accepts anything with a `rarity` so it works on a Creature or serialized
 * creature data.
 */
export function isEliteCreature(creature: { rarity: Rarity }): boolean {
  return ELITE_RARITIES.includes(creature.rarity);
}
