import type { DamageType } from './DamageType';

export type ResistTier = 'resisted' | 'neutral' | 'vulnerable';

/**
 * A transient combat "hit" published by useEncounter for the presentation layer (graphics roadmap
 * Phase 2b). It carries what the combat math already computed at resolve time — damage TYPE and
 * whether the target resisted/was vulnerable — which the 2a derive-from-HP-deltas approach could
 * not see. Consumers process events in ascending `id` order and never mutate combat state.
 */
export interface CombatHitEvent {
  id: number;
  target: 'creature' | 'player';
  /** Post-mitigation amount actually dealt/healed (already floored to an integer). */
  amount: number;
  /** null for untyped events (currently none — the player's basic counter is 'physical'). */
  damageType: DamageType | null;
  resist: ResistTier;
  kind: 'hit' | 'dot' | 'heal';
  /** The target's max HP, so the consumer can size the number by fraction without another lookup. */
  targetMaxHp: number;
}

/**
 * Classify a resistance value (−1..1; see DamageType) into a tell tier. Resistances are authored
 * constants, so exact 0 is neutral; any positive value resists, any negative is a vulnerability.
 */
export function classifyResist(resistance: number): ResistTier {
  if (resistance > 0) return 'resisted';
  if (resistance < 0) return 'vulnerable';
  return 'neutral';
}
