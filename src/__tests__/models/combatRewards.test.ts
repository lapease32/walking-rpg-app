import { activeCombatXp, activeCombatDropChance } from '../../models/combatRewards';
import { COMBAT_CONFIG, LOOT_CONFIG } from '../../constants/config';

describe('activeCombatXp', () => {
  it('boosts the base creature reward by the active multiplier', () => {
    expect(activeCombatXp(100)).toBe(Math.floor(100 * COMBAT_CONFIG.ACTIVE_COMBAT_XP_MULTIPLIER));
  });

  it('floors fractional results to an integer', () => {
    // 7 * 1.5 = 10.5 → 10
    const result = activeCombatXp(7);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(Math.floor(7 * COMBAT_CONFIG.ACTIVE_COMBAT_XP_MULTIPLIER));
  });

  it('always exceeds the passive (unmultiplied) reward for a positive base', () => {
    expect(activeCombatXp(40)).toBeGreaterThan(40);
  });
});

describe('activeCombatDropChance', () => {
  it('is the base drop chance plus the active bonus', () => {
    expect(activeCombatDropChance()).toBeCloseTo(
      LOOT_CONFIG.BASE_DROP_CHANCE + LOOT_CONFIG.ACTIVE_COMBAT_DROP_CHANCE_BONUS,
    );
  });

  it('is strictly higher than the passive base drop chance', () => {
    expect(activeCombatDropChance()).toBeGreaterThan(LOOT_CONFIG.BASE_DROP_CHANCE);
  });
});
