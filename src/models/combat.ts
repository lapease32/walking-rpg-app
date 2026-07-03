/**
 * Ratio-based damage mitigation — the single source of truth for how `defense` reduces an
 * incoming hit.
 *
 *   damage = floor( attack² / (attack + defense) * multiplier ),  clamped to a minimum of 1
 *
 * Replaces the old subtractive `max(1, attack - defense)`, which hard-walled to 1 the moment
 * defense reached the attacker's attack — every further point of defense wasted, with an abrupt
 * cliff on the way there. This curve is smooth and self-scaling instead:
 *   - defense == attack halves the hit (50% mitigation);
 *   - damage approaches 0 as defense grows but never reaches it, so no amount of armor grants
 *     immunity and no attacker is ever fully walled down to chip damage;
 *   - every point of defense always helps (strictly diminishing, never wasted);
 *   - because it keys off the attack/defense RATIO, it stays balanced as both scale with level —
 *     no per-level constant to tune.
 *
 * The min-1 clamp is a display floor (damage is an integer), NOT a wall: real damage scales
 * smoothly above it. `multiplier` is the ability's damage multiplier (1.0 for a basic attack).
 */
export function mitigateDamage(attack: number, defense: number, multiplier = 1): number {
  const atk = Math.max(0, attack);
  const def = Math.max(0, defense);
  const denom = atk + def;
  const raw = denom === 0 ? 0 : (atk * atk) / denom;
  return Math.max(1, Math.floor(raw * multiplier));
}
