export enum Archetype {
  Martial = 'martial',
  Agile = 'agile',
  Mage = 'mage',
}

export type Resource = 'rage' | 'energy' | 'mana';

export interface ArchetypeConfig {
  readonly name: string;
  readonly description: string;
  readonly resource: Resource;
  readonly strBase: number;
  readonly strPerLevel: number;
  readonly agiBase: number;
  readonly agiPerLevel: number;
  readonly intBase: number;
  readonly intPerLevel: number;
  // Flat HP pool that differentiates the tank-to-glass-cannon spectrum
  readonly hpConstant: number;
}

// Stat derivation factors (shared across all archetypes).
// Tuned so Martial at any level ≈ the old level-formula baseline:
//   attack_old  = 20 + (lvl-1)*3   →  Martial L1=19, L10=46  (old 20, 47)
//   defense_old =  5 + (lvl-1)*2   →  Martial L1= 6, L10=22  (old  5, 23)
//   maxHp_old   = 100+ (lvl-1)*10  →  Martial L1=100,L10=181 (old100,190)
//
//   attack  = floor(str * 0.8 + agi * 0.6 + 8)
//   defense = max(1, floor(str * 0.5 + agi * 0.25))
//   maxHp   = hpConstant + str * 3 + agi * 1
//
// INT does not yet contribute to attack — spell scaling arrives in the
// damage-type PR (PR 3), where INT drives elemental / magic damage.

export const ARCHETYPE_CONFIGS: Readonly<Record<Archetype, ArchetypeConfig>> = {
  [Archetype.Martial]: {
    name: 'Warrior',
    description: 'Melee physical damage dealer. High armor and health, fuelled by rage.',
    resource: 'rage',
    strBase: 10,
    strPerLevel: 3,
    agiBase: 6,
    agiPerLevel: 1,
    intBase: 4,
    intPerLevel: 0,
    hpConstant: 64,
  },
  [Archetype.Agile]: {
    name: 'Rogue',
    description: 'Finesse fighter. Swift and precise, medium survivability, fuelled by energy.',
    resource: 'energy',
    strBase: 6,
    strPerLevel: 1,
    agiBase: 10,
    agiPerLevel: 3,
    intBase: 6,
    intPerLevel: 1,
    hpConstant: 52,
  },
  [Archetype.Mage]: {
    name: 'Mage',
    description: 'Elemental spellcaster. Devastating spell damage, fragile body, fuelled by mana.',
    resource: 'mana',
    strBase: 4,
    strPerLevel: 0,
    agiBase: 6,
    agiPerLevel: 1,
    intBase: 10,
    intPerLevel: 3,
    hpConstant: 42,
  },
} as const;

export interface Attributes {
  str: number;
  agi: number;
  int: number;
}

export function computeAttributes(archetype: Archetype, level: number): Attributes {
  const cfg = ARCHETYPE_CONFIGS[archetype];
  const l = Math.max(1, level);
  return {
    str: cfg.strBase + (l - 1) * cfg.strPerLevel,
    agi: cfg.agiBase + (l - 1) * cfg.agiPerLevel,
    int: cfg.intBase + (l - 1) * cfg.intPerLevel,
  };
}

export function deriveAttack(str: number, agi: number): number {
  return Math.max(1, Math.floor(str * 0.8 + agi * 0.6 + 8));
}

export function deriveDefense(str: number, agi: number): number {
  return Math.max(1, Math.floor(str * 0.5 + agi * 0.25));
}

export function deriveMaxHp(archetype: Archetype, str: number, agi: number): number {
  return ARCHETYPE_CONFIGS[archetype].hpConstant + str * 3 + agi * 1;
}

/**
 * Player combat SPEED — drives evasion (glancing/dodge, see models/evasion). Agility-only (mirrors
 * how attack/defense derive from str/agi), so the Agile archetype is tangibly harder to hit. Scaled
 * to sit alongside creature speeds (single digits to ~30s) so the differential reads meaningfully.
 */
export function deriveSpeed(agi: number): number {
  return Math.max(1, Math.floor(agi * 0.6 + 5));
}
