import { ARCHETYPE_ABILITIES } from '../../constants/abilities';
import { Ability, RESOURCE_CONFIGS } from '../../models/Ability';
import { Archetype } from '../../models/Archetype';

const ALL_ARCHETYPES = [Archetype.Martial, Archetype.Agile, Archetype.Mage];
const ALL_ABILITIES: Ability[] = ([] as Ability[]).concat(
  ...ALL_ARCHETYPES.map(a => ARCHETYPE_ABILITIES[a]),
);

describe('ARCHETYPE_ABILITIES — roster completeness', () => {
  it.each(ALL_ARCHETYPES)('%s has 3–5 abilities', archetype => {
    const abilities = ARCHETYPE_ABILITIES[archetype];
    expect(abilities.length).toBeGreaterThanOrEqual(3);
    expect(abilities.length).toBeLessThanOrEqual(5);
  });

  it('has no duplicate ability IDs across all archetypes', () => {
    const ids = ALL_ABILITIES.map(a => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('ARCHETYPE_ABILITIES — field integrity', () => {
  it('every ability has all required base fields', () => {
    for (const ability of ALL_ABILITIES) {
      expect(typeof ability.id).toBe('string');
      expect(ability.id.length).toBeGreaterThan(0);
      expect(typeof ability.name).toBe('string');
      expect(ability.name.length).toBeGreaterThan(0);
      expect(typeof ability.icon).toBe('string');
      expect(ability.cooldownMs).toBeGreaterThan(0);
      expect(ability.resourceCost).toBeGreaterThanOrEqual(0);
      expect(['direct', 'dot', 'buff_debuff', 'defensive']).toContain(ability.primitive);
    }
  });

  it('every direct ability has damageMultiplier > 0 and a valid damageType', () => {
    for (const ability of ALL_ABILITIES) {
      if (ability.primitive !== 'direct') continue;
      expect(ability.damageMultiplier).toBeGreaterThan(0);
      expect(['physical', 'fire', 'frost']).toContain(ability.damageType);
    }
  });

  it('every dot ability has damagePerTick > 0, tickCount > 0, and a valid damageType', () => {
    for (const ability of ALL_ABILITIES) {
      if (ability.primitive !== 'dot') continue;
      expect(ability.damagePerTick).toBeGreaterThan(0);
      expect(ability.tickCount).toBeGreaterThan(0);
      expect(['physical', 'fire', 'frost']).toContain(ability.damageType);
    }
  });

  it('every buff_debuff ability has tickDuration > 0 and at least one stat modifier', () => {
    for (const ability of ALL_ABILITIES) {
      if (ability.primitive !== 'buff_debuff') continue;
      expect(ability.tickDuration).toBeGreaterThan(0);
      const hasModifier =
        ability.statModifiers.attack !== undefined || ability.statModifiers.defense !== undefined;
      expect(hasModifier).toBe(true);
    }
  });

  it('every defensive ability has at least one healing or shielding field', () => {
    for (const ability of ALL_ABILITIES) {
      if (ability.primitive !== 'defensive') continue;
      const hasEffect =
        ability.healAmount !== undefined ||
        ability.healPercent !== undefined ||
        ability.shieldAmount !== undefined;
      expect(hasEffect).toBe(true);
    }
  });
});

describe('ARCHETYPE_ABILITIES — resource cost constraints', () => {
  it.each(ALL_ARCHETYPES)('%s abilities have costs within [0, max]', archetype => {
    const max = RESOURCE_CONFIGS[archetype].max;
    for (const ability of ARCHETYPE_ABILITIES[archetype]) {
      expect(ability.resourceCost).toBeGreaterThanOrEqual(0);
      expect(ability.resourceCost).toBeLessThanOrEqual(max);
    }
  });

  it('Martial has at least one free ability (needed to accumulate rage from zero)', () => {
    const free = ARCHETYPE_ABILITIES[Archetype.Martial].filter(a => a.resourceCost === 0);
    expect(free.length).toBeGreaterThanOrEqual(1);
  });

  it('Agile has at least one free ability (fallback when energy is drained)', () => {
    const free = ARCHETYPE_ABILITIES[Archetype.Agile].filter(a => a.resourceCost === 0);
    expect(free.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ARCHETYPE_ABILITIES — archetype identity', () => {
  it('Mage has at least one fire ability', () => {
    const fire = ARCHETYPE_ABILITIES[Archetype.Mage].filter(
      a => a.primitive === 'direct' && a.damageType === 'fire',
    );
    expect(fire.length).toBeGreaterThanOrEqual(1);
  });

  it('Mage has at least one frost ability', () => {
    const frost = ARCHETYPE_ABILITIES[Archetype.Mage].filter(
      a => a.primitive === 'direct' && a.damageType === 'frost',
    );
    expect(frost.length).toBeGreaterThanOrEqual(1);
  });

  it('Martial has a high-cost execute ability (resourceCost >= 50)', () => {
    const heavy = ARCHETYPE_ABILITIES[Archetype.Martial].filter(a => a.resourceCost >= 50);
    expect(heavy.length).toBeGreaterThanOrEqual(1);
  });

  it('Agile has a DoT ability', () => {
    const dots = ARCHETYPE_ABILITIES[Archetype.Agile].filter(a => a.primitive === 'dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('Mage has a DoT ability', () => {
    const dots = ARCHETYPE_ABILITIES[Archetype.Mage].filter(a => a.primitive === 'dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('each archetype has a different ability set (no cross-archetype sharing)', () => {
    const martialIds = new Set(ARCHETYPE_ABILITIES[Archetype.Martial].map(a => a.id));
    const agileIds = new Set(ARCHETYPE_ABILITIES[Archetype.Agile].map(a => a.id));
    const mageIds = new Set(ARCHETYPE_ABILITIES[Archetype.Mage].map(a => a.id));
    for (const id of martialIds) {
      expect(agileIds.has(id)).toBe(false);
      expect(mageIds.has(id)).toBe(false);
    }
    for (const id of agileIds) {
      expect(mageIds.has(id)).toBe(false);
    }
  });
});
