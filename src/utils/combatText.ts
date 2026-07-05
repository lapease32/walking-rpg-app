/**
 * Pure presentation helper for floating combat text (graphics roadmap Phase 2a).
 *
 * There is no crit system in the combat model, so "crit emphasis" is approximated by MAGNITUDE:
 * a hit that removes a bigger fraction of the target's max HP reads heavier (larger, hotter color).
 * Kept pure + separate from the animated component so the mapping is unit-testable. Colors/sizes
 * are feel placeholders — tune by playtesting.
 */

export type CombatTextKind = 'damage' | 'heal';

export interface CombatTextStyle {
  /** Rendered string, e.g. "12" for damage or "+8" for a heal. */
  label: string;
  color: string;
  fontSize: number;
}

const HEAL_COLOR = '#43A047';
const HEAL_FONT_SIZE = 22;

/**
 * Damage tiers by fraction of the target's max HP, highest first. A hit ≥25% of max reads as a
 * heavy blow (big, deep red); glancing hits stay small and amber. `find` returns the first tier
 * whose threshold the fraction clears — the trailing `min: 0` guarantees a match.
 */
const DAMAGE_TIERS = [
  { min: 0.25, color: '#D32F2F', fontSize: 34 }, // heavy
  { min: 0.12, color: '#FF7043', fontSize: 26 }, // solid
  { min: 0, color: '#FFB300', fontSize: 20 }, // glancing
] as const;

export function combatTextStyle(
  amount: number,
  maxHp: number,
  kind: CombatTextKind,
): CombatTextStyle {
  const magnitude = Math.max(0, Math.round(amount));

  if (kind === 'heal') {
    return { label: `+${magnitude}`, color: HEAL_COLOR, fontSize: HEAL_FONT_SIZE };
  }

  const fraction = maxHp > 0 ? magnitude / maxHp : 0;
  const tier = DAMAGE_TIERS.find(t => fraction >= t.min) ?? DAMAGE_TIERS[DAMAGE_TIERS.length - 1];
  return { label: `${magnitude}`, color: tier.color, fontSize: tier.fontSize };
}
