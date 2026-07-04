import {
  autoCombatWinChance,
  computeAutoCombatXp,
  resolveAutoCombat,
} from '../../models/AutoCombat';
import { Creature } from '../../models/Creature';
import { COMBAT_CONFIG } from '../../constants/config';

const makeCreature = (level: number, rarity: Creature['rarity'] = 'common'): Creature =>
  new Creature({
    id: 'c1',
    name: 'Test Beast',
    type: 'Nature',
    level,
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
    rarity,
  });

describe('autoCombatWinChance', () => {
  it('returns the base win rate at even level', () => {
    expect(autoCombatWinChance(5, 5)).toBe(COMBAT_CONFIG.AUTO_COMBAT_BASE_WIN_RATE);
  });

  it('increases when the player out-levels the creature', () => {
    // base 0.75 + step 0.05 * 2 = 0.85
    expect(autoCombatWinChance(7, 5)).toBeCloseTo(
      COMBAT_CONFIG.AUTO_COMBAT_BASE_WIN_RATE + COMBAT_CONFIG.AUTO_COMBAT_LEVEL_STEP * 2,
    );
  });

  it('decreases when the creature out-levels the player', () => {
    // base 0.75 - step 0.05 * 3 = 0.60
    expect(autoCombatWinChance(4, 7)).toBeCloseTo(
      COMBAT_CONFIG.AUTO_COMBAT_BASE_WIN_RATE - COMBAT_CONFIG.AUTO_COMBAT_LEVEL_STEP * 3,
    );
  });

  it('clamps to the ceiling for a large favorable gap', () => {
    expect(autoCombatWinChance(100, 1)).toBe(COMBAT_CONFIG.AUTO_COMBAT_MAX_WIN_RATE);
  });

  it('clamps to the floor for a large unfavorable gap', () => {
    expect(autoCombatWinChance(1, 100)).toBe(COMBAT_CONFIG.AUTO_COMBAT_MIN_WIN_RATE);
  });
});

describe('computeAutoCombatXp', () => {
  it('awards the full creature reward on a win', () => {
    const creature = makeCreature(3);
    expect(computeAutoCombatXp(creature, true)).toBe(creature.getExperienceReward());
  });

  it('awards a fraction of the reward on a loss', () => {
    const creature = makeCreature(3);
    const expected = Math.floor(creature.getExperienceReward() * COMBAT_CONFIG.LOSS_XP_FRACTION);
    expect(computeAutoCombatXp(creature, false)).toBe(expected);
  });

  it('does not apply the active-combat XP multiplier (idle tier only)', () => {
    const creature = makeCreature(3);
    // A passive win must never exceed the plain creature reward — the 1.5x is a stopped-play bonus.
    expect(computeAutoCombatXp(creature, true)).toBeLessThan(
      creature.getExperienceReward() * COMBAT_CONFIG.ACTIVE_COMBAT_XP_MULTIPLIER,
    );
  });
});

describe('resolveAutoCombat', () => {
  it('resolves a win when the roll lands under the win chance', () => {
    const creature = makeCreature(5);
    // rng = 0 is always below any positive win chance.
    const outcome = resolveAutoCombat(5, creature, () => 0);
    expect(outcome.won).toBe(true);
    expect(outcome.xpGained).toBe(creature.getExperienceReward());
  });

  it('resolves a loss when the roll lands above the win chance, with no loot', () => {
    const creature = makeCreature(5);
    // rng = 0.999 exceeds the max win chance (0.95), guaranteeing a loss.
    const outcome = resolveAutoCombat(5, creature, () => 0.999);
    expect(outcome.won).toBe(false);
    expect(outcome.item).toBeNull();
    expect(outcome.xpGained).toBe(
      Math.floor(creature.getExperienceReward() * COMBAT_CONFIG.LOSS_XP_FRACTION),
    );
  });

  it('can drop an item on a win', () => {
    const creature = makeCreature(5);
    // Force the LootService drop roll (Math.random < BASE_DROP_CHANCE) to succeed.
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const outcome = resolveAutoCombat(5, creature, () => 0);
      expect(outcome.won).toBe(true);
      expect(outcome.item).not.toBeNull();
    } finally {
      randomSpy.mockRestore();
    }
  });
});
