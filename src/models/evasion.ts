/**
 * Speed-driven evasion: turns the previously-inert `speed` stat into per-hit variance on a direct
 * attack. Two outcomes soften or negate a hit, keyed off the SPEED differential (defender − attacker):
 *
 *   - GLANCING (primary): a fixed ~half-damage hit. Common + soft — the main way speed shows up.
 *   - DODGED (rare): the hit is fully avoided (0 damage).
 *
 * Design guardrails (see the combat-design notes):
 *   - Base damage stays DETERMINISTIC (mitigateDamage); glancing is the ONLY per-hit variance, so a
 *     low number is always explainable ("GLANCING"), never a hidden ±roll.
 *   - Glance magnitude is FIXED (half) — only WHETHER it glances is luck.
 *   - PLAYER-FAVORED: a player who evades negates the creature's counter (feels great); an enemy
 *     evade denies the player's action (feels bad), so the creature's ceilings are much lower.
 *   - DODGE has PRD-style streak protection: its chance ramps with each consecutive non-dodge and
 *     resets on a dodge — bounding both unlucky droughts and oppressive back-to-back dodges.
 *   - `defense` = consistent reduction; `speed` = variance. Distinct feels, not a second armor stat.
 *
 * Pure + rng-injectable so every branch is unit-testable.
 */

export type EvadeOutcome = 'normal' | 'glancing' | 'dodged';

export const EVASION_CONFIG = {
  /** Glancing deals this fraction of the mitigated hit (floored, min 1). */
  glanceMultiplier: 0.5,
  /** Chance at equal speed. */
  base: { glance: 0.08, dodge: 0.03 },
  /** Added per point of (defenderSpeed − attackerSpeed). */
  slopePerSpeed: { glance: 0.012, dodge: 0.005 },
  /** Ceilings by who is DEFENDING — player-favored, low enemy ceiling. */
  cap: {
    player: { glance: 0.4, dodge: 0.18 },
    creature: { glance: 0.16, dodge: 0.08 },
  },
  /** PRD: dodge chance grows by this × (consecutive non-dodges), capped, resetting on a dodge. */
  prdDodgeGrowth: 0.5,
} as const;

export interface EvasionRoll {
  outcome: EvadeOutcome;
  /** Consecutive non-dodge attacks after this roll (feed back in next time for PRD streak protection). */
  nextDodgeStreak: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Roll a direct hit's evasion for the DEFENDER. `dodgeStreak` is the defender's consecutive
 * non-dodge count (see {@link EvasionRoll.nextDodgeStreak}); pass 0 at the start of a fight.
 */
export function rollEvasion(params: {
  attackerSpeed: number;
  defenderSpeed: number;
  defender: 'player' | 'creature';
  dodgeStreak: number;
  rng?: () => number;
}): EvasionRoll {
  const { attackerSpeed, defenderSpeed, defender, dodgeStreak, rng = Math.random } = params;
  const delta = defenderSpeed - attackerSpeed;
  const caps = EVASION_CONFIG.cap[defender];

  const glance = clamp(
    EVASION_CONFIG.base.glance + EVASION_CONFIG.slopePerSpeed.glance * delta,
    0,
    caps.glance,
  );
  const dodgeBase = clamp(
    EVASION_CONFIG.base.dodge + EVASION_CONFIG.slopePerSpeed.dodge * delta,
    0,
    caps.dodge,
  );
  // PRD ramp — rising until it procs, capped, then reset (nextDodgeStreak = 0 on a dodge).
  const dodge = Math.min(caps.dodge, dodgeBase * (1 + EVASION_CONFIG.prdDodgeGrowth * dodgeStreak));

  const r = rng();
  if (r < dodge) {
    return { outcome: 'dodged', nextDodgeStreak: 0 };
  }
  if (r < dodge + glance) {
    return { outcome: 'glancing', nextDodgeStreak: dodgeStreak + 1 };
  }
  return { outcome: 'normal', nextDodgeStreak: dodgeStreak + 1 };
}

/**
 * Apply an evasion outcome to a mitigated base damage. A glancing hit is half (floored) with a
 * minimum of 1 — BUT only when the hit already dealt something: a fully-resisted/immune 0-damage
 * swing stays 0 (glancing must never invent chip damage that a normal hit wouldn't deal).
 */
export function applyEvasionDamage(baseDamage: number, outcome: EvadeOutcome): number {
  if (outcome === 'dodged' || baseDamage <= 0) {
    return 0;
  }
  if (outcome === 'glancing') {
    return Math.max(1, Math.floor(baseDamage * EVASION_CONFIG.glanceMultiplier));
  }
  return baseDamage;
}
