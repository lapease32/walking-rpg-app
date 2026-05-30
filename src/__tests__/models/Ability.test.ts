import {
  resolveAbility,
  tickStatusEffects,
  initCombatState,
  regenResource,
  RESOURCE_CONFIGS,
  DirectAbility,
  DotAbility,
  BuffDebuffAbility,
  DefensiveAbility,
  CombatantState,
} from '../../models/Ability';
import { Archetype } from '../../models/Archetype';
import { DEFAULT_RESISTANCES, Resistances } from '../../models/DamageType';

const NO_RESIST = DEFAULT_RESISTANCES;
const CASTER_MAX_HP = 100;

const makeDirectAbility = (overrides: Partial<DirectAbility> = {}): DirectAbility => ({
  id: 'test_direct',
  name: 'Test Attack',
  primitive: 'direct',
  damageMultiplier: 1.0,
  cooldownMs: 1000,
  resourceCost: 0,
  icon: '⚔️',
  damageType: 'physical',
  ...overrides,
});

const makeDotAbility = (overrides: Partial<DotAbility> = {}): DotAbility => ({
  id: 'test_dot',
  name: 'Test DoT',
  primitive: 'dot',
  damagePerTick: 5,
  tickCount: 3,
  cooldownMs: 2000,
  resourceCost: 0,
  icon: '🔥',
  damageType: 'fire',
  ...overrides,
});

const makeBuffAbility = (overrides: Partial<BuffDebuffAbility> = {}): BuffDebuffAbility => ({
  id: 'test_buff',
  name: 'Test Buff',
  primitive: 'buff_debuff',
  tickDuration: 2,
  statModifiers: { attack: 5 },
  targetSelf: true,
  cooldownMs: 3000,
  resourceCost: 0,
  icon: '✨',
  ...overrides,
});

const makeDefensiveAbility = (overrides: Partial<DefensiveAbility> = {}): DefensiveAbility => ({
  id: 'test_heal',
  name: 'Test Heal',
  primitive: 'defensive',
  healAmount: 20,
  cooldownMs: 4000,
  resourceCost: 0,
  icon: '💚',
  ...overrides,
});

describe('resolveAbility — direct', () => {
  it('produces the same damage as the old Player.calculateDamage at resistance 0', () => {
    // Old formula: Math.max(1, Math.floor((attack - defense) * multiplier))
    const ability = makeDirectAbility({ damageMultiplier: 1.0 });
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.damage).toBe(Math.max(1, Math.floor((20 - 5) * 1.0)));
    expect(result.heal).toBe(0);
    expect(result.shield).toBe(0);
    expect(result.appliedEffects).toHaveLength(0);
  });

  it('applies damageMultiplier correctly', () => {
    const ability = makeDirectAbility({ damageMultiplier: 1.5 });
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.damage).toBe(Math.max(1, Math.floor((20 - 5) * 1.5)));
  });

  it('enforces minimum 1 raw damage before resistance', () => {
    // attack lower than defense → raw would be negative, clamped to 1
    const ability = makeDirectAbility({ damageMultiplier: 1.0 });
    const result = resolveAbility(ability, 5, 100, NO_RESIST, CASTER_MAX_HP);
    expect(result.damage).toBe(1);
  });

  it('applies resistance to reduce damage', () => {
    const ability = makeDirectAbility({ damageType: 'fire' });
    const resistances: Resistances = { ...NO_RESIST, fire: 0.5 };
    const result = resolveAbility(ability, 20, 0, resistances, CASTER_MAX_HP);
    // raw = max(1, floor(20 * 1.0)) = 20; after 50% resist = floor(20 * 0.5) = 10
    expect(result.damage).toBe(10);
  });

  it('reduces damage to 0 at full immunity', () => {
    const ability = makeDirectAbility({ damageType: 'frost' });
    const resistances: Resistances = { ...NO_RESIST, frost: 1.0 };
    const result = resolveAbility(ability, 20, 0, resistances, CASTER_MAX_HP);
    expect(result.damage).toBe(0);
  });

  it('increases damage at negative resistance (vulnerability)', () => {
    const ability = makeDirectAbility({ damageMultiplier: 1.0 });
    const resistances: Resistances = { ...NO_RESIST, physical: -0.5 };
    const result = resolveAbility(ability, 20, 0, resistances, CASTER_MAX_HP);
    // raw = 20; after -50% resist = floor(20 * 1.5) = 30
    expect(result.damage).toBe(30);
  });
});

describe('resolveAbility — dot', () => {
  it('returns 0 immediate damage', () => {
    const ability = makeDotAbility();
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.damage).toBe(0);
  });

  it('returns a StatusEffect with correct tick count and damage', () => {
    const ability = makeDotAbility({ damagePerTick: 8, tickCount: 4 });
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.appliedEffects).toHaveLength(1);
    const effect = result.appliedEffects[0];
    expect(effect.type).toBe('dot');
    expect(effect.remainingTicks).toBe(4);
    expect(effect.damagePerTick).toBe(8);
    expect(effect.damageType).toBe('fire');
  });
});

describe('resolveAbility — buff_debuff', () => {
  it('returns 0 damage and creates a buff effect when targetSelf=true', () => {
    const ability = makeBuffAbility({ targetSelf: true, statModifiers: { attack: 5 } });
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.damage).toBe(0);
    expect(result.appliedEffects).toHaveLength(1);
    expect(result.appliedEffects[0].type).toBe('buff');
    expect(result.appliedEffects[0].remainingTicks).toBe(2);
    expect(result.appliedEffects[0].statModifiers?.attack).toBe(5);
  });

  it('creates a debuff effect when targetSelf=false', () => {
    const ability = makeBuffAbility({ targetSelf: false, statModifiers: { defense: -3 } });
    const result = resolveAbility(ability, 20, 5, NO_RESIST, CASTER_MAX_HP);
    expect(result.appliedEffects[0].type).toBe('debuff');
  });
});

describe('resolveAbility — defensive', () => {
  it('returns flat heal amount', () => {
    const ability = makeDefensiveAbility({ healAmount: 25 });
    const result = resolveAbility(ability, 0, 0, NO_RESIST, CASTER_MAX_HP);
    expect(result.heal).toBe(25);
    expect(result.damage).toBe(0);
  });

  it('returns percent-based heal floored to integer', () => {
    const ability = makeDefensiveAbility({ healAmount: 0, healPercent: 0.3 });
    const result = resolveAbility(ability, 0, 0, NO_RESIST, 100);
    expect(result.heal).toBe(30); // floor(100 * 0.3)
  });

  it('stacks flat and percent heals', () => {
    const ability = makeDefensiveAbility({ healAmount: 10, healPercent: 0.2 });
    const result = resolveAbility(ability, 0, 0, NO_RESIST, 100);
    expect(result.heal).toBe(30); // 10 + floor(100 * 0.2)
  });

  it('returns shield amount', () => {
    const ability = makeDefensiveAbility({ healAmount: 0, shieldAmount: 15 });
    const result = resolveAbility(ability, 0, 0, NO_RESIST, CASTER_MAX_HP);
    expect(result.shield).toBe(15);
  });
});

describe('tickStatusEffects', () => {
  const makeState = (overrides: Partial<CombatantState> = {}): CombatantState => ({
    statusEffects: [],
    resource: 50,
    ...overrides,
  });

  it('accumulates DoT damage from all active dot effects', () => {
    const state = makeState({
      statusEffects: [
        { id: 'dot1', type: 'dot', remainingTicks: 2, damagePerTick: 5 },
        { id: 'dot2', type: 'dot', remainingTicks: 1, damagePerTick: 3 },
      ],
    });
    const { dotDamage } = tickStatusEffects(state);
    expect(dotDamage).toBe(8);
  });

  it('decrements remainingTicks by 1 each tick', () => {
    const state = makeState({
      statusEffects: [{ id: 'dot1', type: 'dot', remainingTicks: 3, damagePerTick: 5 }],
    });
    const { updatedState } = tickStatusEffects(state);
    expect(updatedState.statusEffects[0].remainingTicks).toBe(2);
  });

  it('removes effects that expire after their last tick', () => {
    const state = makeState({
      statusEffects: [{ id: 'dot1', type: 'dot', remainingTicks: 1, damagePerTick: 5 }],
    });
    const { dotDamage, updatedState } = tickStatusEffects(state);
    expect(dotDamage).toBe(5); // damage dealt on last tick
    expect(updatedState.statusEffects).toHaveLength(0);
  });

  it('returns 0 dotDamage when no effects are active', () => {
    const state = makeState();
    const { dotDamage, updatedState } = tickStatusEffects(state);
    expect(dotDamage).toBe(0);
    expect(updatedState.statusEffects).toHaveLength(0);
  });

  it('does not accumulate dotDamage from buff/debuff effects', () => {
    const state = makeState({
      statusEffects: [
        { id: 'buff1', type: 'buff', remainingTicks: 2, statModifiers: { attack: 5 } },
      ],
    });
    const { dotDamage } = tickStatusEffects(state);
    expect(dotDamage).toBe(0);
  });

  it('preserves resource value through tick', () => {
    const state = makeState({ resource: 42 });
    const { updatedState } = tickStatusEffects(state);
    expect(updatedState.resource).toBe(42);
  });
});

describe('initCombatState', () => {
  it('initializes Martial resource to 0 (rage starts empty)', () => {
    const state = initCombatState(Archetype.Martial);
    expect(state.resource).toBe(RESOURCE_CONFIGS[Archetype.Martial].startValue);
    expect(state.resource).toBe(0);
    expect(state.statusEffects).toHaveLength(0);
  });

  it('initializes Agile resource to 80 (energy starts mostly full)', () => {
    const state = initCombatState(Archetype.Agile);
    expect(state.resource).toBe(80);
  });

  it('initializes Mage resource to 100 (mana starts full)', () => {
    const state = initCombatState(Archetype.Mage);
    expect(state.resource).toBe(100);
  });
});

describe('regenResource', () => {
  it('increases resource by regenPerTurn', () => {
    const state: CombatantState = { statusEffects: [], resource: 20 };
    const updated = regenResource(state, Archetype.Martial);
    expect(updated.resource).toBe(20 + RESOURCE_CONFIGS[Archetype.Martial].regenPerTurn);
  });

  it('does not exceed max resource', () => {
    const state: CombatantState = { statusEffects: [], resource: 98 };
    const updated = regenResource(state, Archetype.Martial); // regenPerTurn=10, max=100
    expect(updated.resource).toBe(100);
  });

  it('preserves status effects through regen', () => {
    const effect = { id: 'buff1', type: 'buff' as const, remainingTicks: 2 };
    const state: CombatantState = { statusEffects: [effect], resource: 50 };
    const updated = regenResource(state, Archetype.Agile);
    expect(updated.statusEffects).toEqual([effect]);
  });
});
