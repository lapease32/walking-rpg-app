/**
 * Passive (idle) auto-combat resolution — the model half of the hybrid idle/active loop.
 *
 * When an encounter fires while the player is walking (moving or app backgrounded), it is
 * resolved here instead of interrupting the walk with the turn-based screen. This module holds
 * the *pure* decision + reward math (win chance, XP); the loot roll is delegated to the existing
 * LootService, and applying rewards to the Player is done by the caller (see useEncounter).
 *
 * Design (locked): passive combat is a NON-PUNISHING reward drip. A loss costs nothing but a
 * smaller XP payout — it never damages the player. Real stakes and better rewards live in the
 * stopped turn-based path. See the pinned combat design + the plan for this slice.
 */
import { Creature } from './Creature';
import { Item } from './Item';
import { dropItem } from '../services/LootService';
import { COMBAT_CONFIG } from '../constants/config';

export interface AutoCombatOutcome {
  won: boolean;
  xpGained: number;
  item: Item | null;
}

/**
 * Probability that passive auto-combat wins, scaled by the player-vs-creature level gap.
 *
 *   chance = clamp( BASE + STEP * (playerLevel - creatureLevel), MIN, MAX )
 *
 * At even level this is exactly AUTO_COMBAT_BASE_WIN_RATE. Out-levelling the creature raises the
 * chance; facing a higher-level creature lowers it — always inside [MIN, MAX] so no gap ever makes
 * a win certain or impossible. Pure and deterministic — the roll happens in resolveAutoCombat.
 */
export function autoCombatWinChance(playerLevel: number, creatureLevel: number): number {
  const raw =
    COMBAT_CONFIG.AUTO_COMBAT_BASE_WIN_RATE +
    COMBAT_CONFIG.AUTO_COMBAT_LEVEL_STEP * (playerLevel - creatureLevel);
  return Math.min(
    COMBAT_CONFIG.AUTO_COMBAT_MAX_WIN_RATE,
    Math.max(COMBAT_CONFIG.AUTO_COMBAT_MIN_WIN_RATE, raw),
  );
}

/**
 * XP awarded from a passive encounter. A win pays the creature's full reward; a loss pays a
 * fraction of it (LOSS_XP_FRACTION) as partial credit for the attempt. Idle-tier only — the
 * active-combat XP multiplier is deliberately NOT applied here (that's the stopped-play bonus).
 */
export function computeAutoCombatXp(creature: Creature, won: boolean): number {
  const reward = creature.getExperienceReward();
  return won ? reward : Math.floor(reward * COMBAT_CONFIG.LOSS_XP_FRACTION);
}

/**
 * Resolve one passive encounter. `rng` is injectable for deterministic tests; production uses
 * Math.random. On a win, loot rolls at the base (idle) drop rate with no active multiplier; a
 * loss yields no item. The caller applies xpGained/item to the Player.
 */
export function resolveAutoCombat(
  playerLevel: number,
  creature: Creature,
  rng: () => number = Math.random,
): AutoCombatOutcome {
  const won = rng() < autoCombatWinChance(playerLevel, creature.level);
  const xpGained = computeAutoCombatXp(creature, won);
  const item = won ? dropItem(false, playerLevel) : null;
  return { won, xpGained, item };
}
