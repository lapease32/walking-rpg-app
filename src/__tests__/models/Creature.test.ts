import { Creature, createCreatureFromTemplate, CREATURE_TEMPLATES } from '../../models/Creature';

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
    it('returns attack minus player defense', () => {
      const creature = makeCreature({ attack: 15 });
      expect(creature.calculateDamage(5)).toBe(10);
    });

    it('enforces minimum of 1 damage', () => {
      const creature = makeCreature({ attack: 5 });
      expect(creature.calculateDamage(100)).toBe(1);
    });

    it('does not floor fractional results (damage is integer input)', () => {
      const creature = makeCreature({ attack: 15 });
      expect(creature.calculateDamage(10)).toBe(5);
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
});
