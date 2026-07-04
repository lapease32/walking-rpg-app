/**
 * Active-combat reward math — the "better loot for stopping to fight" differential.
 *
 * Turn-based (elite) wins pay more than passive auto-combat: more XP, a higher drop chance, and
 * beefier stat rolls (the loot multiplier is applied at generation via generateItem's
 * statMultiplier). Passive resolution (see AutoCombat) stays idle-tier. These are the pure scalar
 * pieces; LootService.dropActiveCombatItem composes the drop chance with item generation.
 */
import { COMBAT_CONFIG, LOOT_CONFIG } from '../constants/config';

/** XP for an active (turn-based) win: the base creature reward boosted by the active multiplier. */
export function activeCombatXp(baseReward: number): number {
  return Math.floor(baseReward * COMBAT_CONFIG.ACTIVE_COMBAT_XP_MULTIPLIER);
}

/** Drop chance for an active (turn-based) win: the base chance plus the active bonus. */
export function activeCombatDropChance(): number {
  return LOOT_CONFIG.BASE_DROP_CHANCE + LOOT_CONFIG.ACTIVE_COMBAT_DROP_CHANCE_BONUS;
}
