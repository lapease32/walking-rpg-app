export type DamageType = 'physical' | 'fire' | 'frost';

// Per-type resistance values on a creature (or eventually a player).
// Range: -1 to 1.
//   0    = neutral (no change)
//   0.25 = 25% damage reduction
//   0.5  = 50% damage reduction
//   1.0  = immune (caller still enforces minimum 1 damage)
//  -0.25 = 25% vulnerability (take 25% more)
export type Resistances = Record<DamageType, number>;

export const DEFAULT_RESISTANCES: Readonly<Resistances> = {
  physical: 0,
  fire: 0,
  frost: 0,
};

// Apply a resistance value to a raw damage number.
// Returns a non-negative integer; minimum-damage enforcement (≥1) is the
// caller's responsibility so immunities can be expressed as true zero.
export function applyResistance(rawDamage: number, resistance: number): number {
  return Math.max(0, Math.floor(rawDamage * (1 - resistance)));
}
