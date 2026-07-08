// Auto-shortening counter-attack beat.
//
// The "enemy turn" cue (banner + dimmed abilities during the counter beat) needs to be readable for
// a NEW player, but the same long beat every turn is tedious for a veteran. The long read-time is
// only a LEARNING need — once a player understands "enemy turn = I wait", they just need enough beat
// to feel turn-based. So the beat eases DOWN as the player takes more active-combat turns: long while
// they're learning, snappy once they've got it. Driven by Player.combatTurnsTaken (persisted).

/** Beat length (ms) for a player's very first active-combat turns — long enough to read the cue. */
export const COUNTER_BEAT_MAX_MS = 2000;
/** Beat length (ms) once the player is combat-experienced — snappy, just enough to feel turn-based. */
export const COUNTER_BEAT_MIN_MS = 1000;
/** Active-combat turns over which the beat eases from MAX to MIN (MIN reached at/after this count). */
export const COUNTER_BEAT_RAMP_TURNS = 20;

/**
 * Counter-attack beat duration (ms) for a player who has taken `combatTurnsTaken` active turns.
 * Linearly eases from COUNTER_BEAT_MAX_MS (0 turns) down to COUNTER_BEAT_MIN_MS (>= RAMP_TURNS).
 * Pure and clamped — negative / non-finite input is treated as 0 (a brand-new player).
 */
export function counterBeatMs(combatTurnsTaken: number): number {
  const turns = Number.isFinite(combatTurnsTaken) ? Math.max(0, combatTurnsTaken) : 0;
  const progress = Math.min(1, turns / COUNTER_BEAT_RAMP_TURNS);
  return Math.round(COUNTER_BEAT_MAX_MS - progress * (COUNTER_BEAT_MAX_MS - COUNTER_BEAT_MIN_MS));
}
