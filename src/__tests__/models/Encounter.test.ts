import { Encounter } from '../../models/Encounter';
import { Creature } from '../../models/Creature';

const makeCreature = () =>
  new Creature({
    id: 'test',
    name: 'Test Creature',
    type: 'Nature',
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 20,
  });

const makeLocation = () => ({ latitude: 37.7749, longitude: -122.4194 });

describe('Encounter', () => {
  describe('constructor', () => {
    it('defaults status to active', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      expect(encounter.status).toBe('active');
    });

    it('defaults playerLevel to 1', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      expect(encounter.playerLevel).toBe(1);
    });

    it('uses provided timestamp', () => {
      const ts = 1234567890;
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation(), timestamp: ts });
      expect(encounter.timestamp).toBe(ts);
    });

    it('generates a timestamp when not provided', () => {
      const before = Date.now();
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      expect(encounter.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('stores the creature and location', () => {
      const creature = makeCreature();
      const location = makeLocation();
      const encounter = new Encounter({ creature, location });
      expect(encounter.creature).toBe(creature);
      expect(encounter.location).toBe(location);
    });
  });

  describe('defeat', () => {
    it('sets status to defeated', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      encounter.defeat();
      expect(encounter.status).toBe('defeated');
    });
  });

  describe('flee', () => {
    it('sets status to fled', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      encounter.flee();
      expect(encounter.status).toBe('fled');
    });
  });

  describe('isActive', () => {
    it('returns true for a new encounter', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      expect(encounter.isActive()).toBe(true);
    });

    it('returns false after defeat', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      encounter.defeat();
      expect(encounter.isActive()).toBe(false);
    });

    it('returns false after fleeing', () => {
      const encounter = new Encounter({ creature: makeCreature(), location: makeLocation() });
      encounter.flee();
      expect(encounter.isActive()).toBe(false);
    });
  });

  describe('createRandomEncounter', () => {
    it('returns an Encounter with a Creature', () => {
      const encounter = Encounter.createRandomEncounter(makeLocation(), 1);
      expect(encounter).toBeInstanceOf(Encounter);
      expect(encounter.creature).toBeInstanceOf(Creature);
    });

    it('sets the playerLevel from the argument', () => {
      const encounter = Encounter.createRandomEncounter(makeLocation(), 5);
      expect(encounter.playerLevel).toBe(5);
    });

    it('starts with active status', () => {
      const encounter = Encounter.createRandomEncounter(makeLocation(), 1);
      expect(encounter.status).toBe('active');
    });
  });
});
