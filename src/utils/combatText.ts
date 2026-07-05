/**
 * Pure presentation helpers for floating combat text (graphics roadmap Phase 2a/2b).
 *
 * There is no crit system in the combat model, so "crit emphasis" is approximated by MAGNITUDE:
 * a hit that removes a bigger fraction of the target's max HP reads heavier (larger). Kept pure +
 * separate from the animated component so the mapping is unit-testable. Colors/sizes are feel
 * placeholders — tune by playtesting.
 */

import type { DamageType } from '../models/DamageType';
import type { CombatHitEvent } from '../models/CombatHitEvent';

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

/** Damage-type text colors (Phase 2b) — the number's COLOR now reads the element, its SIZE the
 *  magnitude. Placeholders. */
const DAMAGE_TYPE_COLOR: Record<DamageType, string> = {
  physical: '#ECEFF1', // near-white
  fire: '#FF7043',
  frost: '#4FC3F7',
  arcane: '#BA68C8',
};
const RESISTED_COLOR = '#90A4AE'; // muted blue-grey — the hit "bounced"
const BUFF_COLOR = '#FFD54F'; // warm gold — empowered
const DEBUFF_COLOR = '#B39DDB'; // desaturated violet — weakened
const STATUS_FONT_SIZE = 18;

/**
 * Style a floating number for a typed combat hit (Phase 2b). Reuses combatTextStyle for the
 * magnitude→size mapping, then layers the damage-type color and the resistance TELL: a resisted hit
 * is muted + "RESIST" and a touch smaller; a vulnerable hit keeps the type color + "WEAK" and reads
 * bigger. Heals defer to the heal styling; buff/debuff show their stat label in a warm/cool tone so
 * a status cast reads as empower/weaken rather than damage.
 */
export function hitFloaterStyle(event: CombatHitEvent): CombatTextStyle {
  if (event.kind === 'heal') {
    return combatTextStyle(event.amount, event.targetMaxHp, 'heal');
  }
  if (event.kind === 'buff' || event.kind === 'debuff') {
    return {
      label: event.label ?? (event.kind === 'buff' ? '▲' : '▼'),
      color: event.kind === 'buff' ? BUFF_COLOR : DEBUFF_COLOR,
      fontSize: STATUS_FONT_SIZE,
    };
  }

  const { fontSize } = combatTextStyle(event.amount, event.targetMaxHp, 'damage');
  const amount = Math.max(0, Math.round(event.amount));
  const typeColor = event.damageType
    ? DAMAGE_TYPE_COLOR[event.damageType]
    : DAMAGE_TYPE_COLOR.physical;

  if (event.resist === 'resisted') {
    return {
      label: `${amount} RESIST`,
      color: RESISTED_COLOR,
      fontSize: Math.round(fontSize * 0.85),
    };
  }
  if (event.resist === 'vulnerable') {
    return { label: `${amount} WEAK`, color: typeColor, fontSize: Math.round(fontSize * 1.15) };
  }
  return { label: `${amount}`, color: typeColor, fontSize };
}
