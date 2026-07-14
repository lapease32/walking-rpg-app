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
  /** Overrides the type default — see SPAWN_WINDOW_BY_TYPE / spawnWindowFor. */
  spawnWindow?: SpawnWindow;
}

/**
 * When a creature can be met. The axis is MUNDANE vs SUPERNATURAL, not "friendly vs scary":
 * daylight creatures are still horrible — a mangy street hound, a boiling knot of vermin — they're
 * just things that could plausibly exist. Night is for the things that shouldn't.
 */
export type SpawnWindow = 'day' | 'night' | 'any';

/**
 * The creature `type` already encodes the mundane/supernatural axis, so it supplies the default
 * spawn window and almost no creature needs an explicit one. A template can still override via
 * `spawnWindow` when its flavour disagrees with its element.
 */
export const SPAWN_WINDOW_BY_TYPE: Record<string, SpawnWindow> = {
  // Mundane — grounded, believable, could exist. Daylight.
  Beast: 'day',
  Vermin: 'day',
  Earth: 'day',
  Construct: 'day',
  Nature: 'day',
  // Supernatural — things that shouldn't exist. Night.
  Shadow: 'night',
  Undead: 'night',
  Spirit: 'night',
  Arcane: 'night',
  // Elemental / liminal — at home in either light.
  Fire: 'any',
  Frost: 'any',
  Water: 'any',
  Air: 'any',
  Ooze: 'any',
  Fungus: 'any',
};

/** A template's spawn window: its explicit override, else its type default, else 'any'. */
export function spawnWindowFor(
  template: Pick<CreatureTemplate, 'type' | 'spawnWindow'>,
): SpawnWindow {
  return template.spawnWindow ?? SPAWN_WINDOW_BY_TYPE[template.type] ?? 'any';
}

/**
 * Relative likelihood of meeting a creature at a given time — NOT a yes/no gate.
 *
 * A hard binary ("this hound is physically incapable of being outdoors after sunset") is more
 * absurd than the problem it solves. The world isn't a clock: a day creature might be out at night
 * because something drove it out, and a night thing might be caught in the light. So a creature is
 * simply MUCH more likely in its own window, and rare — but possible — outside it. That preserves
 * the day/night identity while leaving room for an unsettling exception.
 */
export const SPAWN_WEIGHTS = {
  /** In its natural light. */
  inWindow: 1,
  /** Out of place — uncommon, but the world doesn't run on a timetable. ~6.7:1 against. */
  offWindow: 0.15,
  /** Elemental / liminal — equally at home in either light. */
  any: 1,
} as const;

/**
 * How likely this template is right now, relative to its peers. `daylight` comes from the REAL sun
 * (models/sun) — NEVER from the app's theme, which is only a cosmetic preference (a theme toggle
 * must not be a spawn switch).
 *
 * Always > 0: every creature stays possible at every hour, which is the point.
 */
export function spawnWeightAt(
  template: Pick<CreatureTemplate, 'type' | 'spawnWindow'>,
  daylight: boolean,
): number {
  const window = spawnWindowFor(template);
  if (window === 'any') {
    return SPAWN_WEIGHTS.any;
  }
  const inWindow = daylight ? window === 'day' : window === 'night';
  return inWindow ? SPAWN_WEIGHTS.inWindow : SPAWN_WEIGHTS.offWindow;
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
    // Overrides its Earth default (day): a fire-forged titan is ELEMENTAL, not mundane — it belongs
    // to neither the daylit world nor the dark one, so it is equally at home in both.
    spawnWindow: 'any',
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
  // ─── Low-tier roster expansion (the 80–95% of encounters). Commons stay resistance-free (quick
  // early fights); each uncommon owns ONE light resist/weak so damage-type choice starts to matter
  // before the elite tiers — across the uncommons every damage type gets a resistor + a weakling.
  // Stats are level-1 base (scaled at spawn); all balance PLACEHOLDERS, tuned via playtest.
  {
    id: 'alley_cur',
    name: 'Alley Cur',
    type: 'Beast',
    maxHp: 52,
    attack: 16,
    defense: 6,
    speed: 24,
    rarity: 'common',
    description: 'A half-wild dog that rules a stretch of backstreet.',
    encounterRate: 0.55,
  },
  {
    id: 'gutter_swarm',
    name: 'Gutter Swarm',
    type: 'Vermin',
    maxHp: 44,
    attack: 17,
    defense: 4,
    speed: 28,
    rarity: 'common',
    description: 'A boiling knot of rats and roaches that moves as one body.',
    encounterRate: 0.6,
  },
  {
    id: 'mossback_toad',
    name: 'Mossback Toad',
    type: 'Nature',
    maxHp: 66,
    attack: 14,
    defense: 9,
    speed: 11,
    rarity: 'common',
    description: 'A bloated thing crusted in creekbed moss, in no hurry at all.',
    encounterRate: 0.5,
  },
  {
    id: 'grit_golemling',
    name: 'Grit Golemling',
    type: 'Earth',
    maxHp: 58,
    attack: 16,
    defense: 8,
    speed: 15,
    rarity: 'common',
    description: 'A knee-high clot of gravel and grime, scraped up off the path.',
    encounterRate: 0.5,
  },
  {
    id: 'pale_stray',
    name: 'Pale Stray',
    type: 'Shadow',
    maxHp: 48,
    attack: 19,
    defense: 4,
    speed: 22,
    rarity: 'common',
    description: 'A gaunt figure that shuffles the night streets, always reaching.',
    encounterRate: 0.5,
  },
  {
    id: 'sump_ooze',
    name: 'Sump Ooze',
    type: 'Ooze',
    maxHp: 64,
    attack: 14,
    defense: 8,
    speed: 9,
    rarity: 'common',
    description: 'A crawling slick of gutter-runoff that swallows what it touches.',
    encounterRate: 0.5,
  },
  {
    id: 'ash_wretch',
    name: 'Ash Wretch',
    type: 'Undead',
    maxHp: 52,
    attack: 18,
    defense: 6,
    speed: 19,
    rarity: 'common',
    description: 'A soot-caked thing that claws its way out of a cold hearth.',
    encounterRate: 0.5,
  },
  {
    id: 'copper_sentinel',
    name: 'Copper Sentinel',
    type: 'Construct',
    maxHp: 62,
    attack: 16,
    defense: 9,
    speed: 14,
    rarity: 'common',
    description: 'A knee-high watch-construct, long forgotten and still on patrol.',
    encounterRate: 0.45,
  },
  {
    id: 'cinder_hound',
    name: 'Cinder Hound',
    type: 'Fire',
    maxHp: 60,
    attack: 23,
    defense: 7,
    speed: 30,
    rarity: 'uncommon',
    description: 'A lean hound that smoulders as it runs; flame slides off its coat.',
    encounterRate: 0.32,
    resistances: { fire: 0.2 },
  },
  {
    id: 'bog_lurker',
    name: 'Bog Lurker',
    type: 'Water',
    maxHp: 78,
    attack: 19,
    defense: 10,
    speed: 11,
    rarity: 'uncommon',
    description: 'It surfaces from cold, still water and never feels the chill.',
    encounterRate: 0.3,
    resistances: { frost: 0.2 },
  },
  {
    id: 'gale_wisp',
    name: 'Gale Wisp',
    type: 'Air',
    maxHp: 52,
    attack: 23,
    defense: 6,
    speed: 37,
    rarity: 'uncommon',
    description: 'A darting scrap of loose wind — a hard frost stops it cold.',
    encounterRate: 0.33,
    resistances: { frost: -0.2 },
  },
  {
    id: 'scrap_golem',
    name: 'Scrap Golem',
    type: 'Earth',
    maxHp: 74,
    attack: 20,
    defense: 12,
    speed: 10,
    rarity: 'uncommon',
    description: 'A shambling heap of rebar and rust; blades ring off and do little.',
    encounterRate: 0.28,
    resistances: { physical: 0.2 },
  },
  {
    id: 'frost_molting',
    name: 'Frost Molting',
    type: 'Frost',
    maxHp: 66,
    attack: 21,
    defense: 8,
    speed: 18,
    rarity: 'uncommon',
    description: 'A brittle shell of hoarfrost; one flame shatters it.',
    encounterRate: 0.3,
    resistances: { fire: -0.2 },
  },
  {
    id: 'fungal_creeper',
    name: 'Fungal Creeper',
    type: 'Fungus',
    maxHp: 74,
    attack: 19,
    defense: 7,
    speed: 12,
    rarity: 'uncommon',
    description: 'A lattice of pale mushroom-flesh that steel shears right through.',
    encounterRate: 0.3,
    resistances: { physical: -0.2 },
  },
  {
    id: 'null_moth',
    name: 'Null Moth',
    type: 'Arcane',
    maxHp: 58,
    attack: 22,
    defense: 7,
    speed: 28,
    rarity: 'uncommon',
    description: 'A moth of dead static that drinks stray magic from the air.',
    encounterRate: 0.3,
    resistances: { arcane: 0.2 },
  },
  {
    id: 'bound_revenant',
    name: 'Bound Revenant',
    type: 'Spirit',
    maxHp: 70,
    attack: 20,
    defense: 10,
    speed: 13,
    rarity: 'uncommon',
    description: 'A soul lashed to old bones; raw arcane snaps the binding.',
    encounterRate: 0.28,
    resistances: { arcane: -0.2 },
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
 * Pick an encounter creature template weighted by player level: roll a rarity (level-scaled), then
 * a template of that rarity (weighted by the time of day). Falls back to the full pool if no
 * template of the rolled rarity exists (keeps the function safe if the template set changes).
 *
 * `daylight` (from the REAL sun — see models/sun) shifts WHICH creature you meet, never HOW GOOD
 * the encounter is: see pickEncounterTemplateOfRarity for why rarity is untouched.
 */
export function pickEncounterTemplate(
  playerLevel: number = 1,
  daylight?: boolean,
): CreatureTemplate {
  const rarity = rollEncounterRarity(playerLevel);
  return pickEncounterTemplateOfRarity(rarity, daylight);
}

/**
 * Pick a random template of a SPECIFIC rarity — also used by debug encounter-forcing to reliably
 * spawn a common (→ passive) or elite (→ held) creature.
 *
 * TIME OF DAY IS COSMETIC. The rarity is decided BEFORE this function is reached, and the day/night
 * WEIGHTING is applied strictly WITHIN that rarity's pool — so the rarity distribution (and
 * therefore loot, XP and progression) is provably identical by day and by night. Night is
 * DIFFERENT, never BETTER: a game that rewarded night walking would be pushing people to walk alone
 * in the dark.
 *
 * Weighting rather than filtering also means no creature is ever *excluded*, so there is no
 * "nothing is eligible" edge case to fall back from — only the (unchanged) guard for a rarity that
 * has no templates at all.
 */
export function pickEncounterTemplateOfRarity(
  rarity: Rarity,
  daylight?: boolean,
  rng: () => number = Math.random,
): CreatureTemplate {
  const ofRarity = CREATURE_TEMPLATES.filter(t => t.rarity === rarity);
  const pool = ofRarity.length > 0 ? ofRarity : CREATURE_TEMPLATES;

  // `undefined` = the caller has no sun information (a unit test, or debug encounter-forcing) →
  // every creature equally likely.
  if (daylight === undefined) {
    return pool[Math.floor(rng() * pool.length)];
  }

  const weights = pool.map(t => spawnWeightAt(t, daylight));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1]; // float drift only
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
