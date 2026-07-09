import {
  Creature,
  createCreatureFromTemplate,
  CREATURE_TEMPLATES,
  rollEncounterRarity,
  pickEncounterTemplate,
  pickEncounterTemplateOfRarity,
  isEliteCreature,
  ELITE_RARITIES,
} from '../../models/Creature';
import { DEFAULT_RESISTANCES, applyResistance } from '../../models/DamageType';

const makeCreature = (overrides: Partial<ConstructorParameters<typeof Creature>[0]> = {}) =>
  new Creature({
    id: 'test_creature',
    name: 'Test Creature',
    type: 'Nature',
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
    ...overrides,
  });

describe('Creature', () => {
  describe('constructor', () => {
    it('sets hp to maxHp when hp is not provided', () => {
      const creature = makeCreature({ maxHp: 80 });
      expect(creature.hp).toBe(80);
      expect(creature.maxHp).toBe(80);
    });

    it('uses provided hp when specified', () => {
      const creature = makeCreature({ maxHp: 80, hp: 30 });
      expect(creature.hp).toBe(30);
    });

    it('defaults level to 1', () => {
      const creature = makeCreature();
      expect(creature.level).toBe(1);
    });

    it('defaults rarity to common', () => {
      const creature = makeCreature();
      expect(creature.rarity).toBe('common');
    });

    it('sets description from provided value', () => {
      const creature = makeCreature({ description: 'A fierce beast' });
      expect(creature.description).toBe('A fierce beast');
    });

    it('generates a default description from type when not provided', () => {
      const creature = makeCreature({ type: 'Shadow' });
      expect(creature.description).toBe('A Shadow creature');
    });
  });

  describe('getRarityMultiplier', () => {
    it.each([
      ['common', 1.0],
      ['uncommon', 1.5],
      ['rare', 2.0],
      ['epic', 3.0],
      ['legendary', 5.0],
    ] as const)('returns %s for %s rarity', (rarity, expected) => {
      const creature = makeCreature({ rarity });
      expect(creature.getRarityMultiplier()).toBe(expected);
    });
  });

  describe('getExperienceReward', () => {
    it('returns 10 for a common level 1 creature', () => {
      const creature = makeCreature({ level: 1, rarity: 'common' });
      expect(creature.getExperienceReward()).toBe(10);
    });

    it('scales with level', () => {
      const level3 = makeCreature({ level: 3, rarity: 'common' });
      expect(level3.getExperienceReward()).toBe(30);
    });

    it('scales with rarity multiplier', () => {
      const rare = makeCreature({ level: 2, rarity: 'rare' });
      // floor(10 * 2 * 2.0) = 40
      expect(rare.getExperienceReward()).toBe(40);
    });

    it('applies legendary multiplier correctly', () => {
      const legendary = makeCreature({ level: 3, rarity: 'legendary' });
      // floor(10 * 3 * 5.0) = 150
      expect(legendary.getExperienceReward()).toBe(150);
    });
  });

  describe('isDefeated', () => {
    it('returns false when hp is above 0', () => {
      const creature = makeCreature({ maxHp: 50, hp: 1 });
      expect(creature.isDefeated()).toBe(false);
    });

    it('returns true when hp reaches 0', () => {
      const creature = makeCreature({ maxHp: 50 });
      creature.takeDamage(50);
      expect(creature.isDefeated()).toBe(true);
    });
  });

  describe('takeDamage', () => {
    it('reduces hp by the given amount', () => {
      const creature = makeCreature({ maxHp: 50 });
      creature.takeDamage(20);
      expect(creature.hp).toBe(30);
    });

    it('clamps hp to 0, never negative', () => {
      const creature = makeCreature({ maxHp: 50 });
      creature.takeDamage(9999);
      expect(creature.hp).toBe(0);
    });
  });

  describe('calculateDamage', () => {
    // Ratio-based mitigation (see combat.ts mitigateDamage): attack² / (attack + defense).
    it('mitigates via the ratio formula', () => {
      const creature = makeCreature({ attack: 15 });
      expect(creature.calculateDamage(5)).toBe(11); // 15² / 20 = 11.25 → 11
    });

    it('enforces minimum of 1 damage against overwhelming defense', () => {
      const creature = makeCreature({ attack: 5 });
      expect(creature.calculateDamage(100)).toBe(1); // 25/105 → floor 0 → clamped to 1
    });

    it('floors fractional damage to an integer', () => {
      const creature = makeCreature({ attack: 15 });
      expect(creature.calculateDamage(10)).toBe(9); // 15² / 25 = 9
    });
  });

  describe('createCreatureFromTemplate', () => {
    it('creates a Creature instance from a template', () => {
      const template = CREATURE_TEMPLATES[0];
      const creature = createCreatureFromTemplate(template, 1);
      expect(creature).toBeInstanceOf(Creature);
      expect(creature.name).toBe(template.name);
    });

    it('scales stats by level', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // level variation: floor(0.5*5)-2=0, so level=playerLevel
      const template = CREATURE_TEMPLATES[0];
      const level5Creature = createCreatureFromTemplate(template, 5);
      expect(level5Creature.level).toBe(5);
      expect(level5Creature.maxHp).toBeGreaterThan(template.maxHp);
      jest.restoreAllMocks();
    });

    it('never creates a creature below level 1', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0); // level variation: floor(0*5)-2=-2, clamped to 1
      const template = CREATURE_TEMPLATES[0];
      const creature = createCreatureFromTemplate(template, 1);
      expect(creature.level).toBeGreaterThanOrEqual(1);
      jest.restoreAllMocks();
    });
  });

  describe('resistances', () => {
    it('defaults all resistances to 0', () => {
      const creature = makeCreature();
      expect(creature.resistances).toEqual(DEFAULT_RESISTANCES);
    });

    it('merges partial resistances with defaults', () => {
      const creature = makeCreature({ resistances: { fire: 0.5 } });
      expect(creature.resistances.fire).toBe(0.5);
      expect(creature.resistances.physical).toBe(0);
      expect(creature.resistances.frost).toBe(0);
    });
  });

  describe('applyResistance helper', () => {
    it('returns raw damage unchanged at resistance 0', () => {
      expect(applyResistance(20, 0)).toBe(20);
    });

    it('halves damage at resistance 0.5', () => {
      expect(applyResistance(20, 0.5)).toBe(10);
    });

    it('floors fractional results', () => {
      expect(applyResistance(21, 0.5)).toBe(10);
    });

    it('increases damage at negative resistance (vulnerability)', () => {
      expect(applyResistance(20, -0.5)).toBe(30);
    });

    it('returns 0 at full immunity (resistance 1.0)', () => {
      expect(applyResistance(20, 1.0)).toBe(0);
    });
  });
});

describe('encounter rarity scaling (level-weighted)', () => {
  const rateOf = (predicate: (r: string) => boolean, lvl: number, n = 2000) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (predicate(rollEncounterRarity(lvl))) c++;
    return c;
  };
  const rareRate = (lvl: number) => rateOf(r => r === 'rare', lvl);
  const eliteRate = (lvl: number) => rateOf(r => r === 'rare' || r === 'epic', lvl);
  const epicRate = (lvl: number) => rateOf(r => r === 'epic', lvl);

  it('NEVER rolls rare at level 1 (no unwinnable above-common fights for new players)', () => {
    for (let i = 0; i < 400; i++) {
      expect(rollEncounterRarity(1)).not.toBe('rare');
    }
  });

  it('rolls mostly common at level 1', () => {
    let common = 0;
    for (let i = 0; i < 500; i++) {
      if (rollEncounterRarity(1) === 'common') common++;
    }
    expect(common).toBeGreaterThan(350); // >70%
  });

  it('elite frequency (rare+epic) increases with level band (and is 0 at L1)', () => {
    expect(rareRate(1)).toBe(0);
    expect(eliteRate(6)).toBeGreaterThan(eliteRate(3));
    expect(eliteRate(12)).toBeGreaterThan(eliteRate(6));
    expect(eliteRate(20)).toBeGreaterThan(eliteRate(12));
  });

  it('epic only appears at high level and grows from there', () => {
    expect(epicRate(6)).toBe(0); // no epic below the L12 band
    expect(epicRate(12)).toBeGreaterThan(0);
    expect(epicRate(20)).toBeGreaterThan(epicRate(12));
  });

  it('pickEncounterTemplate returns a real template, never rare at level 1', () => {
    const ids = new Set(CREATURE_TEMPLATES.map(t => t.id));
    for (let i = 0; i < 200; i++) {
      const t = pickEncounterTemplate(1);
      expect(ids.has(t.id)).toBe(true);
      expect(t.rarity).not.toBe('rare');
    }
  });
});

describe('elite creature roster', () => {
  it('has a varied elite roster (multiple rare templates + at least one epic)', () => {
    const rares = CREATURE_TEMPLATES.filter(t => t.rarity === 'rare');
    const epics = CREATURE_TEMPLATES.filter(t => t.rarity === 'epic');
    // No longer just Mountain Guardian — worthy foes should vary.
    expect(rares.length).toBeGreaterThanOrEqual(2);
    expect(epics.length).toBeGreaterThanOrEqual(1);
  });

  it('carries a template resistance profile through onto the created creature', () => {
    const epic = CREATURE_TEMPLATES.find(t => t.id === 'ashen_colossus')!;
    const creature = createCreatureFromTemplate(epic, 10);
    // Resist fire, vulnerable to frost — makes damage-type choice matter against elites.
    expect(creature.resistances.fire).toBeGreaterThan(0);
    expect(creature.resistances.frost).toBeLessThan(0);
    // Unspecified types fall back to the neutral default.
    expect(creature.resistances.arcane).toBe(0);
  });
});

describe('CREATURE_TEMPLATES data integrity', () => {
  it('has no duplicate ids', () => {
    const ids = CREATURE_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has positive combat stats and a valid rarity', () => {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const t of CREATURE_TEMPLATES) {
      expect(t.maxHp).toBeGreaterThan(0);
      expect(t.attack).toBeGreaterThan(0);
      expect(t.defense).toBeGreaterThanOrEqual(0);
      expect(t.speed).toBeGreaterThan(0);
      expect(rarities).toContain(t.rarity);
    }
  });

  it('every resistance value is a sane fraction in [-1, 1]', () => {
    for (const t of CREATURE_TEMPLATES) {
      for (const value of Object.values(t.resistances ?? {})) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('isEliteCreature', () => {
  it('classifies rare and above as elite (held for turn-based)', () => {
    expect(isEliteCreature({ rarity: 'rare' })).toBe(true);
    expect(isEliteCreature({ rarity: 'epic' })).toBe(true);
    expect(isEliteCreature({ rarity: 'legendary' })).toBe(true);
  });

  it('classifies common and uncommon as non-elite (auto-resolved passively)', () => {
    expect(isEliteCreature({ rarity: 'common' })).toBe(false);
    expect(isEliteCreature({ rarity: 'uncommon' })).toBe(false);
  });

  it('works on a full Creature instance', () => {
    expect(isEliteCreature(makeCreature({ rarity: 'rare' }))).toBe(true);
    expect(isEliteCreature(makeCreature({ rarity: 'common' }))).toBe(false);
  });

  it('ELITE_RARITIES is exactly rare/epic/legendary', () => {
    expect([...ELITE_RARITIES].sort()).toEqual(['epic', 'legendary', 'rare']);
  });
});

describe('pickEncounterTemplateOfRarity (debug forcing)', () => {
  it('returns a template of the requested rarity when one exists', () => {
    for (const r of ['common', 'uncommon', 'rare', 'epic'] as const) {
      for (let i = 0; i < 20; i++) {
        expect(pickEncounterTemplateOfRarity(r).rarity).toBe(r);
      }
    }
  });

  it('falls back to a real template when no template of that rarity exists (e.g. legendary)', () => {
    const ids = new Set(CREATURE_TEMPLATES.map(t => t.id));
    const t = pickEncounterTemplateOfRarity('legendary');
    expect(ids.has(t.id)).toBe(true);
  });
});
